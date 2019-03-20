const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format for people type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/people?' + QueryString.stringify({
      q: 'ada people',
      'filter[occupation]': 'mathematician; computer pioneer',
      'filter[birth[place]]': 'London, Greater London, England, United Kingdom',
      'filter[birth[date]]': '1600',
      'filter[death[date]]': '2000',
      'filter[organisations]': 'person'
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

