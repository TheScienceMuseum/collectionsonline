const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(
  file + 'Should accept params in filter[PARAMS_NAME] format for group type',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/search/group?' + QueryString.stringify({}),
      headers: { Accept: 'text/html' },
    };
    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  }
);
