/* tmp remove test : JU : 20/11/2017
const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

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

testWithServer(file + 'Search for docs with images', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/search/documents?' + QueryString.stringify({
      q: 'calculating machine',
      'filter[archive]': 'The Babbage Papers'
    }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('class="resultcard__figure"') > -1, 'image shows in results');
    t.end();
  });
});
*/
