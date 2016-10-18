const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

testWithServer(file + 'Should process RESULT_CLICK analytics event', {}, (t, ctx) => {
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

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 204, 'Status was OK');
    t.end();
  });
});

testWithServer(file + 'empty response if not a json request', {}, (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'POST',
    url: '/analytics',
    payload: JSON.stringify({ event: 'RESULT_CLICK', data: 'smg-objects-12345' })
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 200, 'Nothing special');
    t.end();
  });
});
