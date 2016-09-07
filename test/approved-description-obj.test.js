const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Archive HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-520148',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    var data = response.data.attributes;
    t.equal(data.webDescription[0].value, data.options.option1, 'The description has the value of the approved description');
    t.end();
  });
});
