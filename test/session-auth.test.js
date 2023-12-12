const testWithServer = require('./helpers/test-with-server');
const config = require('../config');

testWithServer('Authentication is ok', {}, async (t, ctx) => {
  t.plan(2);
  // mock config user
  const user = config.user;
  const password = config.password;
  config.user = 'testUser';
  config.password = 'securePassword';

  const htmlRequest = {
    method: 'POST',
    url: '/session',
    payload: { username: 'testUser', password: 'securePassword' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 302, 'Authentication is ok and staus code rediction 302');
  t.equal(res.headers.location, '/', 'Redirect to home page');
  config.user = user;
  config.password = password;
  t.end();
}, true);

testWithServer('Authentication is not ok', {}, async (t, ctx) => {
  t.plan(1);
  // mock config user
  const user = config.user;
  const password = config.password;
  config.user = 'testUser';
  config.password = 'securePassword';

  const htmlRequest = {
    method: 'POST',
    url: '/session',
    payload: { username: 'wrongUser', password: 'wrongPassword' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'status code 200, display login page');
  config.user = user;
  config.password = password;
  t.end();
}, true);
