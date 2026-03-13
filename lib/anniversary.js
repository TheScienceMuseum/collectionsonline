const slug = require('slugg');
const widgetConfig = require('../config/anniversary-widget.json');

module.exports = async function getAnniversaryData (elastic, config) {
  const enabled = widgetConfig.enabled ||
    process.env.ANNIVERSARY_ENABLED === 'true';

  if (!enabled) return null;

  const today = new Date();
  const overrides = getOverridesForDate(today);

  try {
    const results = await Promise.all([
      widgetConfig.objects.enabled
        ? getObjectAnniversaries(elastic, config, today, overrides)
        : null,
      widgetConfig.people.enabled
        ? getPeopleAnniversaries(elastic, config, today, overrides)
        : null
    ]);

    const objects = results[0];
    const people = results[1];

    if (!hasResults(objects) && !hasResults(people)) return null;

    return {
      objects: objects ? { sectionTitle: widgetConfig.objects.sectionTitle, items: objects } : null,
      people: people ? { sectionTitle: widgetConfig.people.sectionTitle, items: people } : null
    };
  } catch (err) {
    console.error('Anniversary widget error:', err.message || err);
    return null;
  }
};

module.exports.secondsUntilMidnightUTC = secondsUntilMidnightUTC;
module.exports._getObjectAnniversaries = getObjectAnniversaries;
module.exports._getPeopleAnniversaries = getPeopleAnniversaries;
module.exports._getOverridesForDate = getOverridesForDate;
module.exports._transformObjectHit = transformObjectHit;
module.exports._transformPersonHit = transformPersonHit;

function hasResults (items) {
  return Array.isArray(items) && items.length > 0;
}

function secondsUntilMidnightUTC () {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

function getOverridesForDate (date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const key = mm + '-' + dd;
  const dateOverrides = widgetConfig.overrides && widgetConfig.overrides.dates;
  return (dateOverrides && dateOverrides[key]) || null;
}

// --- Object Anniversaries ---

async function getObjectAnniversaries (elastic, config, today, overrides) {
  const cfg = widgetConfig.objects;
  const currentYear = today.getFullYear();
  const count = cfg.count;

  // Handle overrides first
  let overrideItems = [];
  if (overrides && overrides.objects && overrides.objects.length > 0) {
    overrideItems = await fetchByIds(elastic, config, overrides.objects, currentYear);
    if (overrideItems.length >= count) {
      return overrideItems.slice(0, count);
    }
  }

  const remaining = count - overrideItems.length;
  const overrideIds = overrideItems.map(function (item) { return item.id; });

  const targetYears = cfg.milestones.map(function (m) {
    return { yearsAgo: m, year: String(currentYear - m) };
  });

  const milestoneBoosts = targetYears.map(function (t) {
    const weight = (cfg.milestoneBoosts && cfg.milestoneBoosts[String(t.yearsAgo)]) || 1;
    return {
      filter: { term: { 'creation.date.from': t.year } },
      weight
    };
  });

  const must = [
    { term: { '@datatype.base': 'object' } }
  ];

  if (cfg.requireImage) {
    must.push({ exists: { field: 'multimedia.@processed.large_thumbnail.location' } });
  }

  const mustNot = [];
  if (overrideIds.length > 0) {
    mustNot.push({ ids: { values: overrideIds } });
  }

  const functions = milestoneBoosts.slice();

  if (cfg.preferOnDisplay) {
    functions.push({
      filter: { exists: { field: 'facility' } },
      weight: cfg.onDisplayBoost || 5
    });
  }

  functions.push({
    field_value_factor: {
      field: 'enhancement.analytics.current.cumulative_views',
      modifier: cfg.viewsBoostModifier || 'sqrt',
      factor: cfg.viewsBoostFactor || 0.01,
      missing: 1
    }
  });

  // Daily shuffle: fetch extra candidates, then pick randomly in JS.
  // This avoids random_score being drowned out by large milestone weights.
  const fetchSize = Math.max(remaining * 5, 15);

  const body = {
    size: fetchSize,
    query: {
      function_score: {
        query: {
          bool: {
            must,
            should: targetYears.map(function (t) {
              return { term: { 'creation.date.from': t.year } };
            }),
            minimum_should_match: 1,
            must_not: mustNot
          }
        },
        functions,
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  const result = await elastic.search({ index: 'ciim', body });
  const hits = result.body.hits.hits || [];

  const allItems = hits.map(function (hit) {
    return transformObjectHit(hit, config, currentYear);
  });

  // Pick one object per milestone year for variety, then fill remaining
  const dateSeed = today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 + today.getDate();
  const picked = diverseMilestoneSample(allItems, remaining, cfg.milestones, dateSeed);

  return overrideItems.concat(picked);
}

// --- People Anniversaries ---

async function getPeopleAnniversaries (elastic, config, today, overrides) {
  const cfg = widgetConfig.people;
  const currentYear = today.getFullYear();
  const count = cfg.count;

  // Handle overrides first
  let overrideItems = [];
  if (overrides && overrides.people && overrides.people.length > 0) {
    overrideItems = await fetchByIds(elastic, config, overrides.people, currentYear);
    if (overrideItems.length >= count) {
      return overrideItems.slice(0, count);
    }
  }

  const remaining = count - overrideItems.length;
  const overrideIds = overrideItems.map(function (item) { return item.id; });

  const daySuffixes = getDaySuffixes(today, cfg.dayRange || 0);

  const must = [
    { term: { '@datatype.base': 'agent' } }
  ];

  if (cfg.mimsyOnly) {
    must.push({ term: { '@admin.source': 'Mimsy XG' } });
  }

  // birth.date.value is a text field — standard analyzer tokenizes "1810-01-29"
  // into ["1810","01","29"]. Use match_phrase on "MM DD" to match adjacent tokens.
  const birthMatchClauses = daySuffixes.map(function (suffix) {
    // suffix is e.g. "-03-13", extract MM and DD
    const parts = suffix.split('-').filter(Boolean);
    return { match_phrase: { 'birth.date.value': parts[0] + ' ' + parts[1] } };
  });

  if (birthMatchClauses.length === 1) {
    must.push(birthMatchClauses[0]);
  } else {
    must.push({
      bool: { should: birthMatchClauses, minimum_should_match: 1 }
    });
  }

  const mustNot = [];
  if (overrideIds.length > 0) {
    mustNot.push({ ids: { values: overrideIds } });
  }

  const functions = [
    {
      filter: { exists: { field: 'multimedia.@processed.large_thumbnail.location' } },
      weight: cfg.imageBoost || 8
    },
    {
      filter: { exists: { field: 'description' } },
      weight: cfg.biographyBoost || 3
    },
    {
      field_value_factor: {
        field: 'enhancement.analytics.current.cumulative_views',
        modifier: cfg.viewsBoostModifier || 'sqrt',
        factor: cfg.viewsBoostFactor || 0.1,
        missing: 1
      }
    },
    {
      filter: { exists: { field: 'death.date' } },
      weight: cfg.deathDateBoost || 1.5
    }
  ];

  const fetchSize = Math.max(remaining * 5, 10);

  const body = {
    size: fetchSize,
    query: {
      function_score: {
        query: {
          bool: {
            must,
            must_not: mustNot
          }
        },
        functions,
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  const result = await elastic.search({ index: 'ciim', body });
  const hits = result.body.hits.hits || [];

  const candidates = hits.map(function (hit) {
    return transformPersonHit(hit, config, currentYear);
  });

  const dateSeed = today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 + today.getDate();
  const picked = seededSample(candidates, remaining, dateSeed + 1);

  let allItems = overrideItems.concat(picked);

  // Fallback: if too few results and fallback enabled, try birth month
  if (allItems.length < (cfg.fallbackMinResults || 1) && cfg.fallbackToBirthMonth) {
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const fallbackResult = await getPeopleFallback(elastic, config, mm, currentYear, cfg, overrideIds);
    allItems = allItems.concat(fallbackResult);
  }

  return allItems.slice(0, count);
}

async function getPeopleFallback (elastic, config, month, currentYear, cfg, excludeIds) {
  const must = [
    { term: { '@datatype.base': 'agent' } },
    { match: { 'birth.date.value': month } }
  ];

  if (cfg.mimsyOnly) {
    must.push({ term: { '@admin.source': 'Mimsy XG' } });
  }

  const mustNot = [];
  if (excludeIds.length > 0) {
    mustNot.push({ ids: { values: excludeIds } });
  }

  const body = {
    size: cfg.count,
    query: {
      function_score: {
        query: { bool: { must, must_not: mustNot } },
        functions: [
          {
            filter: { exists: { field: 'multimedia.@processed.large_thumbnail.location' } },
            weight: cfg.imageBoost || 8
          },
          {
            field_value_factor: {
              field: 'enhancement.analytics.current.cumulative_views',
              modifier: 'sqrt',
              factor: 0.1,
              missing: 1
            }
          }
        ],
        score_mode: 'sum',
        boost_mode: 'multiply'
      }
    }
  };

  const result = await elastic.search({ index: 'ciim', body });
  const hits = result.body.hits.hits || [];

  return hits.map(function (hit) {
    return transformPersonHit(hit, config, currentYear);
  });
}

// --- Overrides: fetch specific records by ID ---

async function fetchByIds (elastic, config, ids, currentYear) {
  try {
    const result = await elastic.mget({
      index: 'ciim',
      body: { ids }
    });

    const docs = result.body.docs || [];
    return docs
      .filter(function (doc) { return doc.found; })
      .map(function (doc) {
        const base = doc._source && doc._source['@datatype'] && doc._source['@datatype'].base;
        if (base === 'object') {
          return transformObjectHit(doc, config, currentYear);
        } else if (base === 'agent') {
          return transformPersonHit(doc, config, currentYear);
        }
        return null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Anniversary override fetch error:', err.message || err);
    return [];
  }
}

// --- Transform helpers ---

function transformObjectHit (hit, config, currentYear) {
  const source = hit._source || {};
  const id = hit._id || (source['@admin'] && source['@admin'].uid) || '';
  const title = getTitle(source);
  const titleSlug = slug(title || '').toLowerCase();
  const type = 'objects';

  const creationDate = getCreationDate(source);
  const yearsAgo = creationDate ? currentYear - parseInt(creationDate, 10) : null;
  const makerInfo = getMakerInfo(source);

  const milestoneLabel = yearsAgo
    ? yearsAgo + ' years ago'
    : widgetConfig.objects.sectionTitle;

  let subtitle = '';
  if (makerInfo.role && makerInfo.name) {
    subtitle = capitaliseFirst(makerInfo.role) + ' by ' + makerInfo.name;
    if (creationDate) subtitle += ', ' + creationDate;
  } else if (creationDate) {
    subtitle = creationDate;
  }

  return {
    id,
    type,
    title: title || 'Untitled object',
    link: (config.rootUrl || '') + '/' + type + '/' + id + (titleSlug ? '/' + titleSlug : ''),
    figure: getImage(source, config),
    milestoneLabel,
    subtitle,
    yearsAgo,
    year: creationDate,
    label: milestoneLabel + ' — ' + (title || 'Untitled object')
  };
}

function transformPersonHit (hit, config, currentYear) {
  const source = hit._source || {};
  const id = hit._id || (source['@admin'] && source['@admin'].uid) || '';
  const title = getTitle(source);
  const titleSlug = slug(title || '').toLowerCase();
  const type = 'people';

  const birthYear = getBirthYear(source);
  const yearsAgo = birthYear ? currentYear - parseInt(birthYear, 10) : null;
  const entityType = source['@datatype'] && source['@datatype'].actual;
  const isOrganisation = entityType === 'organisation';

  const cfg = widgetConfig.people;
  const labelTemplate = isOrganisation ? cfg.organisationLabel : cfg.personLabel;
  const milestoneLabel = birthYear
    ? labelTemplate.replace('{year}', birthYear)
    : cfg.sectionTitle;

  const occupation = getOccupation(source);
  const figcaption = getBriefBiography(source);

  return {
    id,
    type,
    title: title || 'Unknown person',
    link: (config.rootUrl || '') + '/' + type + '/' + id + (titleSlug ? '/' + titleSlug : ''),
    figure: getImage(source, config),
    figcaption,
    milestoneLabel,
    subtitle: occupation,
    yearsAgo,
    birthYear,
    entityType: entityType || 'person',
    label: milestoneLabel + ' — ' + (title || 'Unknown person')
  };
}

// --- Field extraction helpers ---

function getTitle (source) {
  const summary = source.summary;
  if (summary && summary.title) return summary.title;

  const name = source.name;
  if (!name) return null;
  if (Array.isArray(name)) {
    const primary = name.find(function (n) { return n.primary; });
    return primary ? primary.value : (name[0] && name[0].value);
  }
  if (name.value) return name.value;
  return null;
}

function getCreationDate (source) {
  const creation = source.creation;
  if (!creation) return null;

  const dates = creation.date;
  if (!dates) return null;

  if (Array.isArray(dates)) {
    const first = dates[0];
    return first && first.from;
  }
  return dates.from;
}

function getMakerInfo (source) {
  const creation = source.creation;
  if (!creation || !creation.maker) return { role: null, name: null };

  const makers = Array.isArray(creation.maker) ? creation.maker : [creation.maker];
  const first = makers[0];
  if (!first) return { role: null, name: null };

  const link = first['@link'] || {};
  const roles = link.role;
  let role = null;
  if (Array.isArray(roles) && roles.length > 0) {
    role = roles[0].value;
  } else if (roles && roles.value) {
    role = roles.value;
  }

  let name = null;
  const summary = link.summary || first.summary;
  if (summary && summary.title) {
    name = summary.title;
  }

  return { role: role || 'made', name };
}

function getBirthYear (source) {
  const birth = source.birth;
  if (!birth || !birth.date) return null;

  if (birth.date.from) return birth.date.from;
  if (birth.date.value) {
    const match = birth.date.value.match(/^(\d{4})/);
    return match ? match[1] : null;
  }
  return null;
}

function getBriefBiography (source) {
  const desc = source.description;
  if (!desc || !Array.isArray(desc)) return null;
  const bio = desc.find(function (d) { return d.type === 'brief biography'; });
  return bio ? bio.value : null;
}

function getOccupation (source) {
  const occ = source.occupation;
  if (!occ) return null;
  if (Array.isArray(occ)) {
    return occ[0] && occ[0].value;
  }
  return occ.value || null;
}

function getImage (source, config) {
  const multimedia = source.multimedia;
  if (!multimedia) return null;

  // multimedia is an array in the ES schema
  const first = Array.isArray(multimedia) ? multimedia[0] : multimedia;
  if (!first) return null;

  const processed = first['@processed'];
  if (!processed) return null;

  // The codebase uses large_thumbnail for card images
  const thumb = processed.large_thumbnail || processed.large;
  if (!thumb || !thumb.location) return null;

  const mediaPath = (config && config.mediaPath) || '';
  return mediaPath + thumb.location;
}

function getDaySuffixes (date, dayRange) {
  const suffixes = [];
  for (let offset = -dayRange; offset <= dayRange; offset++) {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    suffixes.push('-' + mm + '-' + dd);
  }
  return suffixes;
}

function capitaliseFirst (str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Simple seeded PRNG (mulberry32) for deterministic daily shuffle
function seededRandom (seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededSample (items, count, seed) {
  if (items.length <= count) return items;
  const pool = items.slice();
  const result = [];
  let s = seed;
  while (result.length < count && pool.length > 0) {
    s = s * 16807 + 1;
    const idx = Math.floor(seededRandom(s) * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// Pick one item per distinct milestone year (e.g. 100, 75, 50) for variety.
// Milestones array defines priority order. Falls back to duplicates only
// when there aren't enough distinct years to fill `count`.
function diverseMilestoneSample (items, count, milestones, seed) {
  if (items.length <= count) return items;

  // Group items by yearsAgo
  const byYear = {};
  items.forEach(function (item) {
    const key = item.yearsAgo || 'unknown';
    if (!byYear[key]) byYear[key] = [];
    byYear[key].push(item);
  });

  // Walk milestones in priority order, pick one per year
  const result = [];
  const usedYears = [];
  let s = seed;

  milestones.forEach(function (m) {
    if (result.length >= count) return;
    const bucket = byYear[m];
    if (!bucket || bucket.length === 0) return;

    s = s * 16807 + 1;
    const idx = Math.floor(seededRandom(s) * bucket.length);
    result.push(bucket.splice(idx, 1)[0]);
    usedYears.push(m);
  });

  // If still need more, pick from remaining items across all buckets
  if (result.length < count) {
    const usedIds = new Set(result.map(function (r) { return r.id; }));
    const remaining = items.filter(function (item) { return !usedIds.has(item.id); });
    const extra = seededSample(remaining, count - result.length, s);
    extra.forEach(function (item) { result.push(item); });
  }

  return result;
}
