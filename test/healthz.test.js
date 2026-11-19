const testWithServer = require('./helpers/test-with-server');
const stub = require('sinon').stub;
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + '/healthz answers without touching Elasticsearch', {}, async (t, ctx) => {
  t.plan(4);
  const search = stub(ctx.elastic, 'search').rejects(new Error('should not be called'));
  const get = stub(ctx.elastic, 'get').rejects(new Error('should not be called'));

  const res = await ctx.server.inject({ method: 'GET', url: '/healthz' });

  t.equal(res.statusCode, 200, 'status is 200');
  t.equal(res.payload, 'ok', 'body is ok');
  t.match(res.headers['cache-control'], /no-store/, 'response is not cacheable');
  t.notOk(search.called || get.called, 'no Elasticsearch calls');

  search.restore();
  get.restore();
});
