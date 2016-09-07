const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';
const level = require('../lib/level.js');
const stub = require('sinon').stub;

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

testWithServer(file + 'Should handle error', {}, (t, ctx) => {
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

  var levelGet = stub(level, 'get', function (key, cb) {
    cb('error');
  });

  var levelPut = stub(level, 'put', function (key, value, cb) {
    cb(new Error());
  });

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 503, 'Error was logged');
    levelGet.restore();
    levelPut.restore();
    level.close();
    t.end();
  });
});
