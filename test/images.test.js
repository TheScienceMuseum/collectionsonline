const testWithServer = require('./helpers/test-with-server');

// testWithServer('Request for Object Page with image', {}, async (t, ctx) => {
//   t.plan(3);

//   const htmlRequest = {
//     method: 'GET',
//     url: '/objects/co8094437',
//     headers: { Accept: 'application/vnd.api+json' }
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   const response = JSON.parse(res.payload);

//   t.equal(res.statusCode, 200, 'Found Object');
//   t.ok(response.data.attributes.multimedia, 'Object has images');
//   t.ok(response.data.attributes.multimedia[0].processed.large.location, 'Has path');
//   t.end();
// });

// testWithServer('Search for Object Page with image', {}, async (t, ctx) => {
//   t.plan(3);

//   const htmlRequest = {
//     method: 'GET',
//     url: '/search/objects?q=Soyuz',
//     headers: { Accept: 'application/vnd.api+json' }
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   const response = JSON.parse(res.payload);
//   t.equal(res.statusCode, 200, 'Succesful request');
//   t.ok(response.data[0], 'Got results');
//   t.ok(response.data[0].attributes.multimedia, 'First result has image');
//   t.end();
// });

testWithServer('Object Page with no image', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co217511',
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  const response = JSON.parse(res.payload);

  t.equal(res.statusCode, 200, 'Succesful request');
  t.ok(response.data, 'Got results');
  t.end();
});
