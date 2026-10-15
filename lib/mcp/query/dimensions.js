'use strict';

// `group_by` dimensions for breakdown_records: each one builds an ES
// aggregation and parses its result into plain { value, count } buckets.
// Counts are exact distinct-record counts (no sampler, unlike the website's
// facets); multi-valued records count once per value.

const { ToolError } = require('../errors');
const { EXTERNAL_TYPES, MUSEUMS } = require('../vocab');
const { FILTER_FIELDS } = require('./filters');

const TERMS = {
  category: { field: 'category.name.keyword' },
  collection: { field: 'cumulation.collector.summary.title.keyword' },
  maker: { field: 'creation.maker.summary.title.keyword' },
  // Free-text place literals ("Little Chalfont, Buckinghamshire, …") duplicate
  // the linked place names; the website facet drops them the same way.
  place_made: { field: 'creation.place.summary.title.keyword', exclude: '.*[;,].*' },
  // Semicolon-joined "catalogue name" summaries duplicate the single object names.
  object_type: { field: 'name.value.keyword', exclude: '.*;.*' },
  material: { field: 'material.value.keyword' },
  occupation: { field: 'occupation.value.keyword' },
  birth_place: { field: 'birth.place.name.value.keyword' },
  archive: { field: 'fonds.summary.title.keyword' },
  level: { field: 'level.value' },
  person_or_organisation: { field: '@datatype.actual', include: 'person|organisation' },
  // Raw values: folding spelling variants together would double-count records
  // that carry both spellings.
  image_licence: { field: FILTER_FIELDS.licence },
  type: { field: '@datatype.base', label: (key) => EXTERNAL_TYPES[key] || key }
};

// ondisplay holds the museum, the gallery and a "Museum, Gallery" composite
// for every object on display; ~80 distinct values, so one terms agg is exact.
const DISPLAY = { museum: true, gallery: true };

const YES_NO = {
  has_image: FILTER_FIELDS.image,
  on_display: FILTER_FIELDS.onDisplay
};

const DATES = {
  made_decade: { field: 'creation.date.from', interval: 'year', rollup: 'decade' },
  made_century: { field: 'creation.date.from', interval: 'year', rollup: 'century' },
  birth_decade: { field: 'birth.date.from', interval: 'year', rollup: 'decade' },
  added_year: { field: '@admin.added', interval: 'year' },
  added_month: { field: '@admin.added', interval: 'month' },
  republished_year: { field: '@admin.processed', interval: 'year' },
  republished_month: { field: '@admin.processed', interval: 'month' }
};

const DIMENSIONS = [
  ...Object.keys(DISPLAY),
  ...Object.keys(YES_NO),
  ...Object.keys(TERMS),
  ...Object.keys(DATES)
];

const MAX_DATE_BUCKETS = 300;

// Lucene regexps are anchored and case-sensitive, so "railway" becomes
// .*[rR][aA][iI][lL][wW][aA][yY].* — every non-letter is escaped.
const containsRegex = (text) => '.*' + Array.from(String(text).trim().slice(0, 50)).map((ch) => {
  const lo = ch.toLowerCase();
  const up = ch.toUpperCase();
  if (lo !== up && lo.length === 1 && up.length === 1) return `[${lo}${up}]`;
  if (/[0-9]/.test(ch)) return ch;
  return '\\' + ch;
}).join('') + '.*';

const containsText = (text) => {
  const needle = String(text || '').trim().toLowerCase();
  return (value) => !needle || value.toLowerCase().includes(needle);
};

/**
 * Build the aggregations for a dimension.
 * @param {string} dimension - one of DIMENSIONS
 * @param {Object} opts - { limit, match }
 */
const buildAggs = (dimension, { limit = 20, match } = {}) => {
  if (DISPLAY[dimension]) {
    return { dim: { terms: { field: FILTER_FIELDS.onDisplay, size: 500 } } };
  }

  if (YES_NO[dimension]) {
    return {
      dim: {
        filters: {
          filters: {
            yes: { exists: { field: YES_NO[dimension] } },
            no: { bool: { must_not: [{ exists: { field: YES_NO[dimension] } }] } }
          }
        }
      }
    };
  }

  if (TERMS[dimension]) {
    const def = TERMS[dimension];
    const terms = {
      field: def.field,
      size: limit,
      shard_size: Math.max(limit * 10, 1000),
      show_term_doc_count_error: true
    };
    if (match) terms.include = containsRegex(match);
    else if (def.include) terms.include = def.include;
    if (def.exclude) terms.exclude = def.exclude;
    return {
      dim: { terms },
      dim_missing: { missing: { field: def.field } }
    };
  }

  if (DATES[dimension]) {
    const def = DATES[dimension];
    return {
      dim: {
        date_histogram: {
          field: def.field,
          calendar_interval: def.interval,
          format: def.interval === 'year' ? 'yyyy' : 'yyyy-MM',
          min_doc_count: 1
        }
      },
      dim_missing: { missing: { field: def.field } }
    };
  }

  throw new ToolError(`Unknown group_by "${dimension}". Use one of: ${DIMENSIONS.join(', ')}.`);
};

const rollupYears = (buckets, rollup) => {
  const size = rollup === 'century' ? 100 : 10;
  const totals = new Map();
  buckets.forEach((b) => {
    const year = parseInt(b.key_as_string, 10);
    if (Number.isNaN(year)) return;
    const start = Math.floor(year / size) * size;
    totals.set(start, (totals.get(start) || 0) + b.doc_count);
  });
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, count]) => ({
      value: rollup === 'century' ? `${start}-${start + 99}` : `${start}s`,
      count
    }));
};

const displayBuckets = (dimension, buckets, { limit, match }) => {
  const keep = containsText(match);
  if (dimension === 'museum') {
    return MUSEUMS
      .map((m) => ({
        value: m.name,
        count: buckets
          .filter((b) => b.key === m.name || m.aliases.includes(b.key))
          .reduce((sum, b) => sum + b.doc_count, 0)
      }))
      .filter((b) => b.count > 0 && keep(b.value))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  // Galleries come from the "Museum, Gallery" composites, which keeps
  // same-named galleries at different museums apart.
  const museumNames = MUSEUMS.flatMap((m) => [m.name, ...m.aliases]);
  return buckets
    .map((b) => {
      const museum = museumNames.find((name) => b.key.startsWith(name + ', '));
      if (!museum) return null;
      const resolved = MUSEUMS.find((m) => m.name === museum || m.aliases.includes(museum));
      return { value: b.key.slice(museum.length + 2), museum: resolved.name, count: b.doc_count };
    })
    .filter((b) => b && keep(b.value))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

/**
 * Parse the aggregation result for a dimension.
 * @returns {Object} { buckets, other_values_count?, records_without_value?, exact, notes? }
 */
const parseAggs = (dimension, aggs, { limit = 20, match } = {}) => {
  if (DISPLAY[dimension]) {
    const buckets = displayBuckets(dimension, aggs.dim.buckets, { limit, match });
    return { buckets, exact: aggs.dim.sum_other_doc_count === 0 };
  }

  if (YES_NO[dimension]) {
    return {
      buckets: [
        { value: true, count: aggs.dim.buckets.yes.doc_count },
        { value: false, count: aggs.dim.buckets.no.doc_count }
      ],
      exact: true
    };
  }

  if (TERMS[dimension]) {
    const def = TERMS[dimension];
    const label = def.label || ((key) => key);
    const merged = new Map();
    aggs.dim.buckets.forEach((b) => {
      const value = label(b.key);
      merged.set(value, (merged.get(value) || 0) + b.doc_count);
    });
    const errorBound = aggs.dim.doc_count_error_upper_bound || 0;
    return {
      buckets: [...merged.entries()].map(([value, count]) => ({ value, count })),
      other_values_count: aggs.dim.sum_other_doc_count,
      records_without_value: aggs.dim_missing.doc_count,
      exact: errorBound === 0,
      error_bound: errorBound
    };
  }

  const def = DATES[dimension];
  let buckets = def.rollup
    ? rollupYears(aggs.dim.buckets, def.rollup)
    : aggs.dim.buckets.map((b) => ({ value: b.key_as_string, count: b.doc_count }));
  const truncated = buckets.length > MAX_DATE_BUCKETS;
  if (truncated) buckets = buckets.slice(-MAX_DATE_BUCKETS);
  const result = {
    buckets,
    records_without_value: aggs.dim_missing.doc_count,
    exact: true
  };
  if (truncated) result.notes = `Only the most recent ${MAX_DATE_BUCKETS} periods are shown.`;
  return result;
};

module.exports = {
  DIMENSIONS,
  DATE_DIMENSIONS: Object.keys(DATES),
  buildAggs,
  parseAggs,
  containsRegex
};
