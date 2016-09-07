const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const level = require('../lib/level.js');
const stub = require('sinon').stub;
const Stream = require('stream');

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for documents type', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/documents?' + QueryString.stringify({
      q: 'babbage',
      'filter[archive]': 'The Babbage Papers',
      'filter[organisations]': 'Science Museum, London'
    }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Handles Errors Appropriately', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/documents?' + QueryString.stringify({
      q: 'babbage'
    }),
    headers: { Accept: 'text/html' }
  };

  var levelCRS = stub(level, 'createReadStream', function (streamOpts) {
    var stream = new Stream();
    stream.readable = true;

    process.nextTick(function () {
      stream.emit('error', new Error());
    });
    return stream;
  });

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    levelCRS.restore();
    level.close();
    t.end();
  });
});
