const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(
  file + 'Attempt to search with the wrong accept headers',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url:
        '/search/people?' +
        QueryString.stringify({
          q: 'test people',
        }),
      headers: { Accept: 'wrongContent' },
    };

    const res = await ctx.server.inject(htmlRequest);
    // t.equal(res.statusCode, 406, 'Status code was as expected, 406');
    t.equal(res.statusCode, 200, 'Status code was as expected, 200');
    t.end();
  }
);

testWithServer(file + 'Should accept the param people', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url:
      '/search/people?' +
      QueryString.stringify({
        q: 'test people',
      }),
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept the param objects', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url:
      '/search/objects?' +
      QueryString.stringify({
        q: 'test',
      }),
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(
  file + 'Should accept the param documents',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url:
        '/search/documents?' +
        QueryString.stringify({
          q: 'test documents',
        }),
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  }
);

testWithServer(
  file + 'Should accept the param documents',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url:
        '/search/documents?' +
        QueryString.stringify({
          q: 'a',
        }),
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  }
);

testWithServer(file + 'Should accept the param groups', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url:
      '/search/group?' +
      QueryString.stringify({
        q: 'test',
      }),
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});
