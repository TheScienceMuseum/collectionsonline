const testWithServer = require('./helpers/test-with-server');
const stub = require('sinon').stub;
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

const emptySearch = {
  body: {
    hits: { total: { value: 0 }, hits: [] },
    aggregations: { collectors: { buckets: [] } }
  }
};

testWithServer(file + 'Repeat homepage renders reuse widget data instead of re-querying Elasticsearch', {}, async (t, ctx) => {
  t.plan(4);
  const search = stub(ctx.elastic, 'search').resolves(emptySearch);
  const mget = stub(ctx.elastic, 'mget').resolves({ body: { docs: [] } });

  const request = { method: 'GET', url: '/', headers: { Accept: 'text/html' } };

  const first = await ctx.server.inject(request);
  const callsAfterFirst = search.callCount + mget.callCount;
  const second = await ctx.server.inject(request);
  const third = await ctx.server.inject(request);

  t.equal(first.statusCode, 200, 'first render ok');
  t.ok(callsAfterFirst > 0, 'first render queried Elasticsearch for the widgets');
  t.ok(second.statusCode === 200 && third.statusCode === 200, 'later renders ok');
  t.equal(search.callCount + mget.callCount, callsAfterFirst, 'later renders made no further Elasticsearch calls');

  search.restore();
  mget.restore();
});
