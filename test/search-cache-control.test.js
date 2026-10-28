const testWithServer = require('./helpers/test-with-server');
const config = require('../config');
const aggregationsAll = require('./helpers/aggregations-all.json');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

// Stub Elasticsearch with an empty result: these tests are about response headers
const body = {
  hits: { total: { value: 0 }, hits: [] },
  aggregations: {
    all: aggregationsAll,
    total_categories: { all: { doc_count: 0, all_total: { buckets: [] } } }
  }
};
const mock = { method: 'search', response: { data: { body } } };
const production = Object.assign({}, config, { NODE_ENV: 'production' });
const randomUrl = '/search/images/collection/daily-herald-archive?random=1';

testWithServer(file + 'Random JSON search is not cached', { mock }, async (t, ctx) => {
  const res = await ctx.server.inject({
    method: 'GET',
    url: randomUrl,
    headers: { Accept: 'application/json' }
  });
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.headers['cache-control'], 'no-store', 'Cache-Control is no-store');
  t.end();
});

testWithServer(file + 'Random HTML search is not cached', { mock }, async (t, ctx) => {
  const res = await ctx.server.inject({
    method: 'GET',
    url: randomUrl,
    headers: { Accept: 'text/html' }
  });
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.headers['cache-control'], 'no-store', 'Cache-Control is no-store');
  t.end();
});

testWithServer(file + 'Random JSON search is not cached on production', { mock, config: production }, async (t, ctx) => {
  const res = await ctx.server.inject({
    method: 'GET',
    url: randomUrl,
    headers: { Accept: 'application/json' }
  });
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.headers['cache-control'], 'no-store', 'Cache-Control is no-store');
  t.end();
});

testWithServer(file + 'Browse JSON search is cached for 12 hours on production', { mock, config: production }, async (t, ctx) => {
  const res = await ctx.server.inject({
    method: 'GET',
    url: '/search/images/collection/daily-herald-archive',
    headers: { Accept: 'application/json' }
  });
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.headers['cache-control'], 'max-age=43200, must-revalidate', 'Cache-Control is 12 hours');
  t.end();
});

testWithServer(file + 'Freetext JSON search is cached for 60 seconds on production', { mock, config: production }, async (t, ctx) => {
  const res = await ctx.server.inject({
    method: 'GET',
    url: '/search?q=rocket',
    headers: { Accept: 'application/json' }
  });
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.headers['cache-control'], 'public, max-age=60', 'Cache-Control is 60 seconds');
  t.end();
});
