const testWithServer = require('./helpers/test-with-server');
const config = require('../config');

testWithServer('Authentication is ok', {}, (t, ctx) => {
  t.plan(2);
  // mock config user
  const user = config.user;
  const password = config.password;
  config.user = 'testUser';
  config.password = 'securePassword';

  const htmlRequest = {
    method: 'POST',
    url: '/session',
    payload: {'username': 'testUser', 'password': 'securePassword'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 302, 'Authentication is ok and staus code rediction 302');
    t.equal(res.headers.location, '/', 'Redirect to home page');
    config.user = user;
    config.password = password;
    t.end();
  });
}, true);

testWithServer('Authentication is not ok', {}, (t, ctx) => {
  t.plan(1);
  // mock config user
  const user = config.user;
  const password = config.password;
  config.user = 'testUser';
  config.password = 'securePassword';

  const htmlRequest = {
    method: 'POST',
    url: '/session',
    payload: {'username': 'wrongUser', 'password': 'wrongPassword'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'status code 200, display login page');
    config.user = user;
    config.password = password;
    t.end();
  });
}, true);
