const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

testWithServer(file + 'Should suggest completion', {}, async (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'next computer' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(request);
  t.equal(res.statusCode, 200, 'Status was OK');
  t.ok(res.result.data.some((d) => d.attributes.summary_title === 'NeXT Computer (personal computer)'), 'Autocompleted Next successfully');
  t.end();
});

testWithServer(file + 'Should disallow < 3 characters', {}, async (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'ba' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(request);

  t.equal(res.statusCode, 400, 'Status was bad request');
  t.equal(res.payload, 'child "q" fails because ["q" length must be at least 3 characters long]', 'Validation error was as expected');
  t.end();
});

testWithServer(file + 'Autocomplete with type people', {}, async (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'GET',
    url: '/autocomplete/people?' + QueryString.stringify({ q: 'cha' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(request);
  t.equal(res.statusCode, 200, 'Status was OK');
  t.end();
});

testWithServer(file + 'Autocomplete error', { mock: { method: 'search', response: { error: new Error() } } }, async (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'cha' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(request);

  t.equal(res.statusCode, 503, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should return an empty response if accept header is not json', {}, async (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'babb' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(request);
  t.equal(res.statusCode, 200, 'Status was OK');
  t.ok((res.payload === ''), 'Empty response with a html request');
  t.end();
});
