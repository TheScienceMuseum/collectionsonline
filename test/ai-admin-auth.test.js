'use strict';

const test = require('tape');
const adminAuth = require('../lib/ai/admin-auth');

test('admin-auth: isValidToken returns true for matching token', function (t) {
  const config = { adminToken: 'secret123' };
  t.ok(adminAuth.isValidToken('secret123', config), 'matching token valid');
  t.end();
});

test('admin-auth: isValidToken returns false for wrong token', function (t) {
  const config = { adminToken: 'secret123' };
  t.notOk(adminAuth.isValidToken('wrong', config), 'wrong token invalid');
  t.end();
});

test('admin-auth: isValidToken falls back to cacheClearToken', function (t) {
  const config = { cacheClearToken: 'fallback456' };
  t.ok(adminAuth.isValidToken('fallback456', config), 'falls back to cacheClearToken');
  t.end();
});

test('admin-auth: isValidToken prefers adminToken over cacheClearToken', function (t) {
  const config = { adminToken: 'primary', cacheClearToken: 'secondary' };
  t.ok(adminAuth.isValidToken('primary', config), 'primary token works');
  t.notOk(adminAuth.isValidToken('secondary', config), 'secondary token rejected');
  t.end();
});

test('admin-auth: isValidToken returns false for empty/missing', function (t) {
  t.notOk(adminAuth.isValidToken('', { adminToken: 'test' }), 'empty token');
  t.notOk(adminAuth.isValidToken(null, { adminToken: 'test' }), 'null token');
  t.notOk(adminAuth.isValidToken('test', {}), 'no config token');
  t.notOk(adminAuth.isValidToken('test', { adminToken: '' }), 'empty config token');
  t.end();
});

test('admin-auth: validateAdminToken checks cookie', function (t) {
  const config = { adminToken: 'secret' };
  const request = { state: { adminToken: 'secret' } };
  t.ok(adminAuth.validateAdminToken(request, config), 'valid cookie accepted');
  t.end();
});

test('admin-auth: validateAdminToken rejects invalid cookie', function (t) {
  const config = { adminToken: 'secret' };
  const request = { state: { adminToken: 'wrong' } };
  t.notOk(adminAuth.validateAdminToken(request, config), 'invalid cookie rejected');
  t.end();
});

test('admin-auth: validateAdminToken handles missing state', function (t) {
  const config = { adminToken: 'secret' };
  t.notOk(adminAuth.validateAdminToken({}, config), 'no state');
  t.notOk(adminAuth.validateAdminToken({ state: {} }, config), 'no cookie');
  t.end();
});
