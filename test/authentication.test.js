const testWithServer = require('./helpers/test-with-server');
const config = require('../config');
const JWT = require('jsonwebtoken');

const jwtSecret = config.JWT_SECRET;
config.JWT_SECRET = 'enocdethejwt';

testWithServer('Authentication is ok', {}, (t, ctx) => {
  t.plan(1);
  const token = JWT.sign({valid: true}, config.JWT_SECRET);
  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: { cookie: 'token=' + token }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code 200 ok');
    t.end();
  });
}, true);

testWithServer('Attempt to access a page with a wrong cookie', {}, (t, ctx) => {
  t.plan(1);
  const token = JWT.sign({valid: 'wrong cookie value'}, config.JWT_SECRET);
  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: { cookie: 'token=' + token }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 401, 'Not authorized to access the page with a wrong cookie');
    config.JWT_SECRET = jwtSecret;
    t.end();
  });
}, true);
