'use strict';

// Runs a filtered aggregation query for count_records / breakdown_records.
// Without free text the MCP filter is the whole query. With `q`, the query
// goes through lib/search.js so matching and min_score are identical to the
// website search; the aggregations are wrapped in the MCP filter because
// post_filter doesn't apply to aggregations.

const search = require('../../search');
const createQueryParams = require('../../query-params/query-params');
const es = require('../es');
const { buildFilter } = require('./filters');

const NO_MATCH_HINT = 'No records matched. Filter values must match catalogue values exactly (case is ignored). ' +
  'Use breakdown_records with group_by and match to find exact values, e.g. group_by="maker", match="babbage".';

const searchParams = (q, type, page = 0, pageSize = 0) => {
  const qp = createQueryParams('json', {
    query: q ? { q } : {},
    params: { type: type && type !== 'all' ? type : 'all' }
  });
  qp.pageNumber = page;
  qp.pageSize = pageSize;
  return qp;
};

/**
 * @param {Object} elastic
 * @param {Object} args - tool params (filters + q + type)
 * @param {Object} aggs - aggregations to run within the filtered set
 * @returns {{ total, aggs, exact, applied, notes }}
 */
const runAggregation = async (elastic, args, aggs = {}) => {
  const { query, applied } = buildFilter(args);
  const notes = [];
  let total, result, exact;

  if (args.q) {
    const qp = searchParams(args.q, args.type);
    const res = await es.guarded(() => search(elastic, qp, {
      aggs: { scoped: { filter: query, aggs } },
      postFilter: query,
      trackTotalHits: true,
      timeout: es.TIMEOUT,
      requestTimeout: es.REQUEST_TIMEOUT
    }), { heavy: true });
    result = res.body.aggregations.scoped;
    total = result.doc_count;
    exact = res.exact;
    applied.q = qp.q;
    if (qp.q !== args.q) notes.push('Free text was truncated to 100 characters.');
    notes.push('Counts with free text include every record the website search would return, including weak matches.');
  } else {
    const res = await es.search(elastic, { size: 0, track_total_hits: true, query, aggs }, { heavy: Object.keys(aggs).length > 0 });
    result = res.body.aggregations || {};
    total = res.body.hits.total.value;
    exact = res.exact;
  }

  if (total === 0) notes.push(NO_MATCH_HINT);
  return { total, aggs: result, exact, applied, notes };
};

module.exports = { runAggregation, searchParams, NO_MATCH_HINT };
