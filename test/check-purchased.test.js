const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Object with "Purchased" in credit line', (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-67812',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.result.data.attributes.legal, 'Response contains legal object');
    t.notOk(res.result.data.attributes.legal.credit_line, 'Response does not contain credit line');
    t.end();
  });
});

testWithServer('Search request for Object with "Purchased" in credit line', (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/search?q=hawking%20painting',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(res.result.data[0].id, 'smgc-objects-67812', 'Response contains correct object');
    t.notOk(res.result.data[0].attributes.legal.credit_line, 'Response does not contain credit line');
    t.end();
  });
});
