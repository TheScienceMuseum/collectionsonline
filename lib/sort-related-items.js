const config = require('../config');
const TypeMapping = require('./type-mapping');
const getNestedProperty = require('./nested-property');
const getPrimaryValue = require('./get-primary-value');
const sortImages = require('./helpers/jsonapi-response/sort-images');
const slug = require('slugg');

// opts.forWriter: also attach the AI biography writer's fields (linkRole,
// linkName, otherDescriptions). Needs `id`.
module.exports = (related, id, opts) => {
  const sortedRelated = {
    object: [],
    archive: [],
    children: [],
    siblings: []
  };

  related.forEach((el) => {
    const group = el._source['@datatype']?.base;
    let slugValue =
      el._source.summary.title && slug(el._source.summary.title).toLowerCase();
    slugValue = slugValue ? '/' + slugValue : '';
    if (sortedRelated[group]) {
      // Match the sort order the related record's own page uses
      // (lib/jsonapi-response.js → sortImages: position asc, upload_sort
      // desc). Without this the panel thumbnail can differ from what users
      // see after clicking through. Filter entries without @processed
      // because sortImages dereferences it and would otherwise throw.
      const multimedia = Array.isArray(el._source.multimedia)
        ? el._source.multimedia.filter(m => m && m['@processed'])
        : [];
      const sorted = multimedia.length ? sortImages(multimedia) : [];
      const figure = sorted[0]?.['@processed']?.large_thumbnail?.location || null;
      const summaryTitle = el._source.summary.title;
      const description = getPrimaryValue(el._source.description);
      const title = getPrimaryValue(el._source.title);
      const item = {
        id: TypeMapping.toExternal(el._id),
        type: TypeMapping.toExternal(el._source['@datatype'].base),
        attributes: {
          summary_title: summaryTitle,
          // longer text used as figcaption when no image is available, mirroring
          // the search-results card behaviour (description → title → summary_title)
          figcaption: description || title || summaryTitle,
          level: getNestedProperty(el, '_source.level.value'),
          identifier: getPrimaryValue(el._source.identifier),
          figure: figure ? config.mediaPath + figure : null,
          // Primary description text — useful to downstream consumers (e.g. AI
          // biography prompt) that want richer context than title alone.
          description: getPrimaryValue(el._source.description)
        },
        link:
          config.rootUrl +
          '/' +
          TypeMapping.toExternal(el._source['@datatype'].base) +
          '/' +
          TypeMapping.toExternal(el._id) +
          slugValue
      };
      if (id) {
        item.role = getCreationRole(el, id);
      }
      if (id && opts && opts.forWriter) {
        // Writer-only fields (AI biographies, via lib/ai/flatten-related.js).
        // Behind an option because the person page serialises these items
        // into its public JSON (lib/jsonapi-response.js → included).
        //
        // linkRole: the person's role on a non-maker (`agent`) link —
        // sponsor, owner, depicted, inventor (type)… Kept apart from `role`
        // on purpose: templates/helpers/ifcreator.js reads `role` to decide
        // whether the person page's "see more" link filters by maker, and
        // agent-link roles such as supplier or commissioner are in that
        // maker list although the person is not in creation.maker.
        const link = findAgentLink(el, id);
        item.linkRole = getLinkRole(link);
        // The subject's name as the link records it, and the record's other
        // description texts (web description…): the writer is shown the
        // sentences of those that name the subject.
        item.linkName = getLinkName(el, id, link);
        item.otherDescriptions = getOtherDescriptions(el._source.description, description);
      }

      sortedRelated[group].push(item);
    }
  });

  return {
    relatedObjects: sortedRelated.object,
    relatedDocuments: sortedRelated.archive,
    relatedChildren: sortedRelated.children,
    relatedSiblings: sortedRelated.siblings
  };
};

function getCreationRole (item, id) {
  const creation = getNestedProperty(item, '_source.creation');

  if (creation && Array.isArray(creation.maker)) {
    const maker = creation.maker.find((el) => el['@admin']?.uid === id) || {};

    if (maker['@link']) {
      return getPrimaryValue(maker['@link'].role);
    }
  }

  return undefined;
}

// get-related-items matches non-maker links on `agent.@admin.uid`. (This
// used to read `_source.agents` / `admin.uid`, which the index no longer
// has, so the role never came through.)
function findAgentLink (item, id) {
  const agents = getNestedProperty(item, '_source.agent');
  if (!Array.isArray(agents)) return undefined;
  return agents.find((el) => el && el['@admin'] && el['@admin'].uid === id);
}

// Catalogue roles that only say "linked", with nothing about how. Same as
// no role for the writer.
const GENERIC_LINK_ROLES = [
  'association',
  'association details',
  'associated',
  'associated person',
  'associated people'
];

function getLinkRole (link) {
  const roles = (link && link['@link'] && link['@link'].role) || [];
  if (!Array.isArray(roles)) return undefined;
  const seen = new Set();
  const out = [];
  roles.forEach((r) => {
    const value = r && typeof r.value === 'string' ? r.value : (typeof r === 'string' ? r : '');
    value.split(';').forEach((part) => {
      const v = part.trim()
        .replace(/^production\/association role\s+/i, '')
        // "inventor type" is the same role as "inventor (type)"
        .replace(/^(inventor|designer|patentee|maker) type$/i, '$1 (type)');
      const key = v.toLowerCase();
      if (!v || GENERIC_LINK_ROLES.includes(key) || seen.has(key)) return;
      seen.add(key);
      out.push(v);
    });
  });
  return out.length ? out.join(', ') : undefined;
}

function getLinkName (item, id, link) {
  const makers = getNestedProperty(item, '_source.creation.maker');
  const maker = Array.isArray(makers)
    ? makers.find((el) => el && el['@admin'] && el['@admin'].uid === id)
    : undefined;
  const source = maker || link;
  const name = source && source.summary && source.summary.title;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

function getOtherDescriptions (descriptions, primary) {
  if (!Array.isArray(descriptions)) return [];
  return descriptions
    .filter((d) => d && typeof d.value === 'string' && d.value.trim() &&
      d.value !== primary && String(d.type || '').toLowerCase() !== 'note')
    .map((d) => d.value);
}
