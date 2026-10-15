'use strict';

// lib/search.js gained an optional third `opts` argument for the MCP server.
// The website never passes it, so its request bodies must be unchanged.

const test = require('tape');
const search = require('../lib/search');
const createQueryParams = require('../lib/query-params/query-params');

const file = require('path').relative(process.cwd(), __filename) + ' > ';

const capture = async (opts) => {
  let seen;
  const elastic = { search: async (params, conf) => { seen = { params, conf }; return { body: {} }; } };
  const qp = createQueryParams('html', { query: { q: 'rocket', 'filter[categories]': 'Space Technology' }, params: { type: 'objects' } });
  await search(elastic, qp, opts);
  return seen;
};

test(file + 'website calls keep facets, the per-tab post_filter and default timeouts', async (t) => {
  const twoArgs = await capture();
  const emptyOpts = await capture({});
  t.deepEqual(emptyOpts, twoArgs, 'passing {} is identical to passing nothing');
  t.ok(twoArgs.params.body.aggs.total_categories, 'total_categories aggregation');
  t.ok(twoArgs.params.body.aggs.objects, 'facet aggregations');
  t.ok(Object.keys(twoArgs.params.body.post_filter).length, 'post_filter');
  t.notOk('track_total_hits' in twoArgs.params.body);
  t.notOk('_source' in twoArgs.params.body);
  t.equal(twoArgs.params.timeout, '15s');
  t.equal(twoArgs.conf.requestTimeout, 20000);
  t.end();
});

test(file + 'MCP options override aggregations, post_filter, totals, sort, source and timeouts', async (t) => {
  const postFilter = { term: { x: 1 } };
  const seen = await capture({
    aggs: {},
    postFilter,
    trackTotalHits: true,
    sort: [{ '@admin.added': 'desc' }],
    source: ['summary.title'],
    timeout: '8s',
    requestTimeout: 10000
  });
  t.notOk('aggs' in seen.params.body, 'aggs: {} means no aggregations');
  t.deepEqual(seen.params.body.post_filter, postFilter);
  t.equal(seen.params.body.track_total_hits, true);
  t.deepEqual(seen.params.body.sort, [{ '@admin.added': 'desc' }]);
  t.deepEqual(seen.params.body._source, ['summary.title']);
  t.equal(seen.params.timeout, '8s');
  t.equal(seen.conf.requestTimeout, 10000);
  t.ok(seen.params.body.query.function_score, 'ranking query unchanged');

  const withAggs = await capture({ aggs: { scoped: { filter: postFilter } } });
  t.deepEqual(withAggs.params.body.aggs, { scoped: { filter: postFilter } });
  t.end();
});
