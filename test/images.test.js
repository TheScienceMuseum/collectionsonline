const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Object Page with image', (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-8229027',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'Found Object');
    t.ok(response.data.attributes.multimedia, 'Object has images');
    t.ok(response.data.attributes.multimedia[0].processed.large.location, 'Has path');
    t.end();
  });
});

testWithServer('Search for Object Page with image', (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?q=plumed%20hat',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'Succesful request');
    t.ok(response.data[0], 'Got results');
    t.ok(response.data[0].attributes.multimedia, 'First result has image');
    t.end();
  });
});

testWithServer('Object Page with no image', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-114820',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'Succesful request');
    t.ok(response.data, 'Got results');
    t.end();
  });
});
