const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for objects type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      q: 'ada objects',
      'filter[date[from]]': '1600',
      'filter[date[to]]': '2000',
      'filter[makers]': 'Cameron, Julia Margaret',
      'filter[object_type]': 'Poster',
      'filter[places]': 'Kashmir',
      'filter[user]': 'Victoria'
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for objects type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      q: 'rocket',
      'filter[categories]': 'Locomotives and Rolling Stock',
      'filter[date[to]]': '2000',
      'filter[object_type]': 'steam locomotive',
      'filter[user]': 'Liverpool & Manchester Railway'
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for objects type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      'filter[material]': 'glass'
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for objects type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      'filter[material]': ['glass', 'cork']
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should handle object_type filter with space-dash-space values in URL', {}, async (t, ctx) => {
  t.plan(2);

  const res1 = await ctx.server.inject({
    method: 'GET',
    url: '/search/objects/object_type/box---container',
    headers: { Accept: 'text/html' }
  });
  t.equal(res1.statusCode, 200, 'box---container URL returns 200');

  const res2 = await ctx.server.inject({
    method: 'GET',
    url: '/search/objects/object_type/toy---recreational-artefact',
    headers: { Accept: 'text/html' }
  });
  t.equal(res2.statusCode, 200, 'toy---recreational-artefact URL returns 200');
  t.end();
});
