const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for objects type', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      q: 'ada',
      'filter[categories]': 'NMeM - Photographs',
      'filter[date[from]]': '1600',
      'filter[date[to]]': '2000',
      'filter[makers]': 'Cameron, Julia Margaret',
      'filter[type]': 'Poster',
      'filter[places]': 'Kashmir',
      'filter[user]': 'Victoria'
    }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});
