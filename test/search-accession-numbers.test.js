const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for documents type', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/objects?' + QueryString.stringify({
      q: '1995-796'
    }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    const firstResult = JSON.parse(res.payload).data[0];
    t.equal(firstResult.id, 'co67823', 'The first result match the searched accession number');
    t.end();
  });
});
