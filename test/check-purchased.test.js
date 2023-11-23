const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Object with "Purchased" in credit line', {}, async (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co67812',
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(res.result.data.attributes.legal, 'Response contains legal object');
  t.notOk(res.result.data.attributes.legal.credit_line, 'Response does not contain credit line');
  t.end();
});

testWithServer('Search request for Object with "Purchased" in credit line', {}, async (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?q=stephen-hawking&filter[categories]=Art',
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.result.data[0].id, 'co67812', 'Response contains correct object');
  t.notOk(res.result.data[0].attributes.legal.credit_line, 'Response does not contain credit line');
  t.end();
});
