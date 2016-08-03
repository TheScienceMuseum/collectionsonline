const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for login Page', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/login'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
}, true);

testWithServer('Attempt to acces the home page without authorisation', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 401, 'Status code was 401 not authorized');
    t.end();
  });
}, true);
