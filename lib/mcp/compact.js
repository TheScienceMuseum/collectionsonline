'use strict';

// Compact, LLM-friendly serialisers for search hits and full records.
//
// Allow-list only: every field is picked explicitly, and full records are
// built from what the public record page renders (lib/transforms/
// json-to-html-data.js), never from raw `_source`. Internal fields such as
// facility case codes, @hierarchy store paths, archive `web[]` file paths and
// most of `@admin` therefore can't leak.

const getValues = require('../transforms/get-values');
const { EXTERNAL_TYPES, canonicalLicence } = require('./vocab');

const SUMMARY_CHARS = 240;
// Long enough for full biographies and archive arrangement notes (the longest
// seen are ~4,500 characters) while keeping responses bounded.
const DESCRIPTION_CHARS = 12000;

// _source fields a search hit needs; keeps ES responses small.
const HIT_SOURCE = [
  '@admin.uid',
  '@admin.source',
  '@datatype',
  'summary.title',
  'title',
  'name',
  'description',
  'creation.date',
  'creation.maker.summary.title',
  'creation.maker.@admin.uid',
  'creation.maker.@entity',
  'birth.date',
  'death.date',
  'occupation',
  'level.value',
  'fonds.summary.title',
  'fonds.@admin.uid',
  'category.name',
  'ondisplay',
  'multimedia.@processed.large_thumbnail.location',
  'multimedia.legal.rights',
  'enhancement.analytics.current.cumulative_views'
];

// Description types to prefer for a hit summary, per type.
const SUMMARY_TYPES = {
  objects: ['web description', 'catalogue description', 'physical description'],
  documents: ['content description'],
  people: ['brief biography', 'biography'],
  group: []
};

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

const plainText = (html) => String(html == null ? '' : html)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m])
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const truncate = (text, max) => text.length > max
  ? text.slice(0, max).replace(/\s+\S*$/, '') + '…'
  : text;

// Windows file-share paths (\\server\share\…) never belong in agent output.
const looksInternal = (text) => /\\\\[\w.-]+\\/.test(text);

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const recordUrl = (config, type, id) => `${config.rootUrl || ''}/${type}/${id}`;

const pageViews = (source) => {
  const views = source.enhancement && source.enhancement.analytics &&
    source.enhancement.analytics.current && source.enhancement.analytics.current.cumulative_views;
  return typeof views === 'number' ? views : null;
};

const firstLicence = (multimedia) => {
  for (const m of asArray(multimedia)) {
    for (const r of asArray(m.legal && m.legal.rights)) {
      if (r && r.licence) return canonicalLicence(r.licence);
    }
  }
  return null;
};

const hitSummary = (source, type) => {
  const descriptions = asArray(source.description).filter((d) => d && d.value);
  const preferred = (SUMMARY_TYPES[type] || [])
    .map((t) => descriptions.find((d) => d.type === t))
    .find(Boolean) || descriptions[0];
  return preferred ? truncate(plainText(preferred.value), SUMMARY_CHARS) : null;
};

const hitMakers = (source) => {
  const makers = asArray(source.creation && source.creation.maker);
  // Literal makers are auto-copies of linked ones; prefer the linked records.
  const linked = makers.filter((m) => m['@entity'] === 'reference');
  const seen = new Set();
  return (linked.length ? linked : makers)
    .map((m) => ({
      name: m.summary && m.summary.title,
      id: (m['@admin'] && m['@admin'].uid) || undefined
    }))
    .filter((m) => m.name && !seen.has(m.name) && seen.add(m.name))
    .slice(0, 3);
};

const flattenOccupation = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(flattenOccupation).filter(Boolean).join(', ') || null;
  if (raw.value !== undefined) return flattenOccupation(raw.value);
  return null;
};

/**
 * Compact a raw ES search hit.
 * @param {Object} hit - ES hit with _source limited to HIT_SOURCE
 * @param {Object} config - app config (rootUrl, mediaPath)
 */
const compactHit = (hit, config) => {
  const source = hit._source || {};
  const base = source['@datatype'] && source['@datatype'].base;
  const type = EXTERNAL_TYPES[base] || base;
  const id = (source['@admin'] && source['@admin'].uid) || hit._id;
  const item = { type, attributes: source };

  const out = {
    id,
    type,
    title: getValues.getTitle(item) || (source.summary && source.summary.title) || null,
    url: recordUrl(config, type, id)
  };

  const date = getValues.getDate(item);
  if (date) out.date = date;

  if (type === 'objects' || type === 'documents') {
    const makers = hitMakers(source);
    if (makers.length) out.makers = makers;
  }
  if (type === 'objects') {
    const category = asArray(source.category).map((c) => c.name).filter(Boolean);
    if (category.length) out.category = category[0];
  }
  if (type === 'documents') {
    if (source.level && source.level.value) out.level = source.level.value;
    const fonds = asArray(source.fonds)[0];
    if (fonds && fonds.summary) out.archive = { id: fonds['@admin'] && fonds['@admin'].uid, title: fonds.summary.title };
  }
  if (type === 'people') {
    const occupation = flattenOccupation(source.occupation);
    if (occupation) out.occupation = occupation;
    if (source['@datatype'] && source['@datatype'].actual) out.person_or_organisation = source['@datatype'].actual;
  }

  const summary = hitSummary(source, type);
  if (summary) out.summary = summary;

  const display = getValues.getDisplayLocation(item);
  out.on_display = display ? { museum: display.museum, gallery: display.gallery || null } : null;

  const media = asArray(source.multimedia).find((m) => m['@processed'] && m['@processed'].large_thumbnail);
  out.has_image = Boolean(media);
  if (media) {
    out.thumbnail = (config.mediaPath || '') + media['@processed'].large_thumbnail.location;
    const licence = firstLicence(source.multimedia);
    if (licence) out.image_licence = licence;
  }

  const views = pageViews(source);
  if (views !== null) out.page_views = views;

  return out;
};

// --- Full records (from json-to-html-data output) --------------------------

// Catalogue values sometimes carry their own trailing separator
// ("Computer pioneer,"), so trim before joining to avoid ",,".
const joinParts = (parts) => parts
  .map((part) => part.replace(/[\s,;]+$/, ''))
  .filter(Boolean)
  .join(', ');

const flattenValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return plainText(v);
  if (Array.isArray(v)) return joinParts(v.map(flattenValue));
  if (typeof v === 'object') {
    if ('value' in v) return flattenValue(v.value);
    return joinParts(Object.keys(v)
      .filter((k) => k !== 'link' && k !== 'links')
      .map((k) => flattenValue(v[k])));
  }
  return '';
};

// fact[] / details[] entries are { key, value | place | date | makers | … }.
const flattenEntries = (entries) => asArray(entries)
  .map((entry) => {
    const value = joinParts(Object.keys(entry)
      .filter((k) => k !== 'key' && k !== 'link' && k !== 'links')
      .map((k) => flattenValue(entry[k])));
    return { label: entry.key, value };
  })
  .filter((e) => e.label && e.value && !looksInternal(e.value));

const makersFromFacts = (facts) => {
  const makers = [];
  asArray(facts).forEach((entry) => {
    asArray(entry.makers).forEach((m) => {
      const id = /\/people\/((?:cp|ap)\d+)/.exec((m && m.link) || '');
      if (m && m.value) makers.push({ name: m.value, role: entry.key, id: id ? id[1] : undefined });
    });
  });
  return makers;
};

const collectStrings = (v, out) => {
  if (v == null) return out;
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (typeof v === 'object') Object.keys(v).forEach((k) => collectStrings(v[k], out));
  return out;
};

const descriptionText = (description) => {
  const text = collectStrings(description, [])
    .map(plainText)
    .filter((s) => s && !looksInternal(s))
    .join('\n\n');
  return {
    text: truncate(text, DESCRIPTION_CHARS),
    truncated: text.length > DESCRIPTION_CHARS
  };
};

const toIso = (ms) => (typeof ms === 'number' ? new Date(ms).toISOString().slice(0, 10) : undefined);

/**
 * Compact a full record.
 * @param {Object} page - output of json-to-html-data (what the record page renders)
 * @param {Object} source - the raw ES _source (only used for dates, views and links)
 */
const compactRecord = (page, source) => {
  const description = descriptionText(page.description);
  const out = {
    id: page.uid,
    type: page.type,
    title: page.title,
    url: page.links && page.links.self,
    system: page.system && page.system.value
  };
  if (page.identifier) out.identifier = page.identifier;
  if (page.date) out.date = page.date;
  if (page.type === 'documents' && source.level && source.level.value) out.level = source.level.value;
  if (description.text) {
    out.description = description.text;
    if (description.truncated) out.description_truncated = true;
  }

  const makers = makersFromFacts(page.fact);
  if (makers.length) out.makers = makers;
  out.facts = flattenEntries(page.fact).filter((f) => !asArray(page.fact).find((e) => e.key === f.label && e.makers));
  out.details = flattenEntries(page.details);

  const display = asArray(page.displayLocation).map((d) => ({ museum: d.museum, gallery: d.gallery || null }));
  out.on_display = display.length ? display : null;

  const images = asArray(page.images);
  out.image_count = images.length;
  out.images = images.slice(0, 3).map((img) => {
    const rights = img.rights || {};
    return {
      large: img.large,
      thumbnail: img.thumb || img.card,
      iiif: img.zoom,
      licence: rights.licence ? canonicalLicence(rights.licence) : null,
      copyright: rights.details || null,
      credit: img.credit || null
    };
  });

  if (page.wikidata) out.wikidata = page.wikidata;
  const views = pageViews(source);
  if (views !== null) out.page_views = views;
  const admin = source['@admin'] || {};
  if (admin.added) out.added_online = toIso(admin.added);
  if (admin.processed) out.last_republished = toIso(admin.processed);
  return out;
};

module.exports = {
  HIT_SOURCE,
  compactHit,
  compactRecord,
  plainText,
  flattenEntries,
  looksInternal
};
