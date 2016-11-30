const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const file = require('path').relative(process.cwd(), __filename) + ' > ';

testWithServer(file + 'Should suggest completion', {}, (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'babbage' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 200, 'Status was OK');
    t.ok(res.result.data.some((d) => d.attributes.summary_title === 'Printed sheet: Babbage\'s calculating machine'), 'Autocompleted "Printed sheet: Babbage\'s calculating machine" successfully');
    t.end();
  });
});

testWithServer(file + 'Should disallow < 3 characters', {}, (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'ba' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 400, 'Status was bad request');
    t.equal(res.result.errors[0].detail, 'child "q" fails because ["q" length must be at least 3 characters long]', 'Validation error was as expected');
    t.end();
  });
});

testWithServer(file + 'Autocomplete with type people', {}, (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'GET',
    url: '/autocomplete/people?' + QueryString.stringify({ q: 'cha' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 200, 'Status was OK');
    t.end();
  });
});

testWithServer(file + 'Autocomplete error', {mock: {method: 'search', response: {error: new Error()}}}, (t, ctx) => {
  t.plan(1);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'cha' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should return an empty response if accept header is not json', {}, (t, ctx) => {
  t.plan(2);

  const request = {
    method: 'GET',
    url: '/autocomplete?' + QueryString.stringify({ q: 'babb' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(request, (res) => {
    t.equal(res.statusCode, 200, 'Status was OK');
    t.ok((res.payload === ''), 'Empty response with a html request');
    t.end();
  });
});
