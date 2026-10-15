'use strict';

// Flat MCP filter params → one Elasticsearch bool query.
//
// Deliberately independent of the website's lib/facets/create-filters.js,
// which spreads every filter across every record type, ignores licence
// values, never applies on_display, and lets gallery override museum. Every
// MCP tool (count, breakdown, search, hierarchy) builds its filter here, so a
// count for museum X always equals breakdown bucket X.

const { ToolError } = require('../errors');
const {
  TYPES,
  ALL_TYPES,
  MUSEUM_NAMES,
  resolveMuseum,
  museumValues,
  resolveLicence
} = require('../vocab');

// Exact-value filters. `lower` fields use the index's lowercase normaliser,
// which ES also applies to the term at query time; `ci` fields are plain
// keywords matched with case_insensitive; `id` fields are record ids.
const TERM_FILTERS = {
  category: { field: 'category.name.keyword', match: 'ci' },
  collection: { field: 'cumulation.collector.summary.title.lower', match: 'lower' },
  maker: { field: 'creation.maker.summary.title.lower', match: 'lower' },
  place_made: { field: 'creation.place.summary.title.lower', match: 'lower' },
  object_type: { field: 'name.value.keyword', match: 'ci' },
  material: { field: 'material.value.keyword', match: 'ci' },
  archive: { field: 'fonds.summary.title.lower', match: 'lower' },
  archive_id: { field: 'fonds.@admin.uid', match: 'id' },
  level: { field: 'level.value', match: 'ci' },
  parent_id: { field: 'parent.@admin.uid', match: 'id' },
  group_id: { field: 'grouping.@admin.uid', match: 'id' },
  occupation: { field: 'occupation.value.keyword', match: 'ci' },
  birth_place: { field: 'birth.place.name.value.lower', match: 'lower' },
  person_or_organisation: { field: '@datatype.actual', match: 'ci' },
  gallery: { field: 'ondisplay.value.keyword', match: 'ci' }
};

// Year ranges use "fully within the range" semantics, like the website.
const YEAR_RANGES = {
  made: { from: 'creation.date.from', to: 'creation.date.to' },
  born: { from: 'birth.date.from', to: 'birth.date.to' }
};

// Date ranges on record admin dates: ISO dates or ES date math.
const DATE_RANGES = {
  added: '@admin.added',
  republished: '@admin.processed'
};

const DATE_VALUE = /^(\d{4}(-\d{2}(-\d{2})?)?|now([+-]\d+[yMwdhHms])*(\/[yMwdhHms])?)$/;

const IMAGE_FIELD = 'multimedia.@admin.source';
const LICENCE_FIELD = 'multimedia.legal.rights.licence';
const ON_DISPLAY_FIELD = 'ondisplay.value.keyword';

const exists = (field) => ({ exists: { field } });
const anyOf = (clauses) => clauses.length === 1
  ? clauses[0]
  : { bool: { should: clauses, minimum_should_match: 1 } };
const ciTerm = (field, value) => ({ term: { [field]: { value, case_insensitive: true } } });

const termClause = ({ field, match }, value) => {
  const v = String(value).trim();
  if (match === 'ci') return ciTerm(field, v);
  // `lower` fields and record ids are both stored lowercase.
  return { term: { [field]: v.toLowerCase() } };
};

// Inclusive upper bounds: round a partial date up to the end of its period.
const upperBound = (value) => {
  if (/^\d{4}$/.test(value)) return value + '||/y';
  if (/^\d{4}-\d{2}$/.test(value)) return value + '||/M';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value + '||/d';
  return value;
};

const yearClauses = (range, from, to) => {
  const clauses = [];
  if (from !== undefined) {
    clauses.push({ range: { [range.from]: { gte: String(from), format: 'yyyy' } } });
  }
  if (to !== undefined) {
    const lte = String(to) + '||/y';
    clauses.push(anyOf([
      { range: { [range.to]: { lte, format: 'yyyy' } } },
      { bool: { must_not: [exists(range.to)], filter: [{ range: { [range.from]: { lte, format: 'yyyy' } } }] } }
    ]));
  }
  return clauses;
};

const dateClause = (field, from, to, name) => {
  const range = {};
  if (from !== undefined) {
    if (!DATE_VALUE.test(from)) throw new ToolError(`${name}_from must be YYYY, YYYY-MM, YYYY-MM-DD or ES date math like now-1M/M`);
    range.gte = from;
  }
  if (to !== undefined) {
    if (!DATE_VALUE.test(to)) throw new ToolError(`${name}_to must be YYYY, YYYY-MM, YYYY-MM-DD or ES date math like now-1M/M`);
    range.lte = upperBound(to);
  }
  return { range: { [field]: range } };
};

const typeClause = (type) => {
  if (!type || type === 'all') return { terms: { '@datatype.base': ALL_TYPES } };
  const base = TYPES[type];
  if (!base) throw new ToolError(`Unknown type "${type}". Use objects, people, documents, group or all.`);
  return { term: { '@datatype.base': base } };
};

const isSet = (v) => v !== undefined && v !== null && v !== '';

/**
 * Build the ES query for a set of MCP filter params.
 * @param {Object} params - flat tool params (type, museum, has_image, …)
 * @returns {{ query: Object, applied: Object }} the bool query, plus the
 *   normalised filters echoed back to the agent so it can see how its
 *   request was interpreted.
 */
const buildFilter = (params = {}) => {
  const filter = [typeClause(params.type)];
  const mustNot = [];
  const applied = { type: params.type || 'all' };

  Object.keys(TERM_FILTERS).forEach((key) => {
    if (!isSet(params[key])) return;
    filter.push(termClause(TERM_FILTERS[key], params[key]));
    applied[key] = String(params[key]).trim();
  });

  if (isSet(params.museum)) {
    const museum = resolveMuseum(params.museum);
    if (!museum) {
      throw new ToolError(`Unknown museum "${params.museum}". Use one of: ${MUSEUM_NAMES.join(', ')}.`);
    }
    filter.push(anyOf(museumValues(museum).map((v) => ciTerm(ON_DISPLAY_FIELD, v))));
    applied.museum = museum.name;
  }

  if (typeof params.on_display === 'boolean') {
    (params.on_display ? filter : mustNot).push(exists(ON_DISPLAY_FIELD));
    applied.on_display = params.on_display;
  }

  if (typeof params.has_image === 'boolean') {
    (params.has_image ? filter : mustNot).push(exists(IMAGE_FIELD));
    applied.has_image = params.has_image;
  }

  if (isSet(params.image_licence)) {
    const requested = String(params.image_licence).trim();
    if (requested.toLowerCase() === 'none') {
      filter.push(exists(IMAGE_FIELD));
      mustNot.push(exists(LICENCE_FIELD));
      applied.image_licence = 'none (has images, but no licence recorded)';
    } else if (requested.toLowerCase() === 'any') {
      filter.push(exists(LICENCE_FIELD));
      applied.image_licence = 'any';
    } else {
      const values = resolveLicence(requested) || [requested];
      filter.push(anyOf(values.map((v) => ciTerm(LICENCE_FIELD, v))));
      applied.image_licence = values[0];
    }
  }

  Object.keys(YEAR_RANGES).forEach((name) => {
    const from = params[name + '_from'];
    const to = params[name + '_to'];
    if (!isSet(from) && !isSet(to)) return;
    filter.push(...yearClauses(YEAR_RANGES[name], isSet(from) ? from : undefined, isSet(to) ? to : undefined));
    if (isSet(from)) applied[name + '_from'] = from;
    if (isSet(to)) applied[name + '_to'] = to;
  });

  Object.keys(DATE_RANGES).forEach((name) => {
    const from = params[name + '_from'];
    const to = params[name + '_to'];
    if (!isSet(from) && !isSet(to)) return;
    filter.push(dateClause(DATE_RANGES[name], isSet(from) ? from : undefined, isSet(to) ? to : undefined, name));
    if (isSet(from)) applied[name + '_from'] = from;
    if (isSet(to)) applied[name + '_to'] = to;
  });

  // Component parts (SPH) are hidden from search on the website. Asking for
  // the children of a record or the members of a group means wanting the
  // parts, so those include them unless the caller explicitly says otherwise.
  const includeParts = typeof params.include_component_parts === 'boolean'
    ? params.include_component_parts
    : isSet(params.parent_id) || isSet(params.group_id);
  if (!includeParts) mustNot.push({ term: { 'grouping.@link.type': 'SPH' } });
  applied.include_component_parts = includeParts;

  const query = { bool: { filter } };
  if (mustNot.length) query.bool.must_not = mustNot;
  return { query, applied };
};

module.exports = {
  buildFilter,
  TERM_FILTERS,
  FILTER_FIELDS: { image: IMAGE_FIELD, licence: LICENCE_FIELD, onDisplay: ON_DISPLAY_FIELD }
};
