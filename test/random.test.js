const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for 4 random items', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'random': 4
    }),
    headers: { Accept: 'application/json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload).data;
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(result.length, 4, 'Returns 4 items');
    ctx.server.inject(htmlRequest, (res) => {
      var result2 = JSON.parse(res.payload).data;
      t.notDeepEqual(result, result2, 'Random results are not equal');
      t.end();
    });
  });
});

testWithServer(file + 'Query has no effect on randomness', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'random': 2,
      'q': 'rocket'
    }),
    headers: { Accept: 'application/json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload).data;
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(result.length, 2, 'Returns 4 items');
    ctx.server.inject(htmlRequest, (res2) => {
      var result2 = JSON.parse(res2.payload).data;
      t.notDeepEqual(result, result2, 'Random results are not equal');
      t.end();
    });
  });
});

testWithServer(file + 'Query has no effect on randomness', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'random': 2,
      'categories': 'Art'
    }),
    headers: { Accept: 'application/json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload).data;
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(result[0].attributes.categories.find(el => el.name === 'Art'), 'Item in correct category');
    t.end();
  });
});
