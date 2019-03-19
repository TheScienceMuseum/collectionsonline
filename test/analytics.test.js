const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

testWithServer(file + 'Should process RESULT_CLICK analytics event', {}, async (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'POST',
    url: '/analytics',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ event: 'RESULT_CLICK', data: 'smg-objects-12345' })
  };

  const res = await ctx.server.inject(request);
  t.equal(res.statusCode, 204, 'Status was OK');
  t.end();
});

testWithServer(file + 'empty response if not a json request', {}, async (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'POST',
    url: '/analytics',
    payload: JSON.stringify({ event: 'RESULT_CLICK', data: 'smg-objects-12345' })
  };

  const res = await ctx.server.inject(request);
  t.equal(res.statusCode, 200, 'Nothing special');
  t.end();
});
