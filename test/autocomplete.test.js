const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

testWithServer(file + 'Should suggest completion', (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'babbage' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 200, 'Status was OK');
    t.end();
  });
});
