const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      q: 'test',
      'filter[date[from]]': '2016',
      'filter[places]': ['London', 'Bath']
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept date[from] in format YYYY', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept date[from] in format YYYY-MM', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-12' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept date[from] in format YYYY-MM-DD', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-12-12' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept invalid date[from]', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-13-12' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept date[to] in format YYYY', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2012' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept date[to] in format YYYY-MM', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2013-10' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept date[to] in format YYYY-MM-DD', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2010-05-01' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept invalid date[to]', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2016-02-31' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single places for html', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single places for json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple places for html', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: ['London', 'Manchester'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept multiple places as array for json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: ['London', 'Manchester'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple places as csv for json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London,Manchester' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', object_type: 'Model locomotive' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single type as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', object_type: 'Model locomotive' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple types', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', object_type: ['Model locomotive', 'Computer'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept array of types as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', object_type: ['Model locomotive', 'Computer'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single makers', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: 'Charles Babbage' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple makers', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: ['Robert Stephenson', 'Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single people', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: 'Charles Babbage' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple people', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: ['Robert Stephenson', 'Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single organisations', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', organisations: 'Liverpool & Manchester Railway' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple organisations', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', organisations: ['Liverpool & Manchester Railway', 'Aquascutum Group plc'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single categories', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', categories: 'Locomotives' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple categories', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', categories: ['Locomotives', 'Rolling Stock'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept valid museum NRM', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'NRM' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept valid museum SMG', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'SMG' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept valid museum NMeM', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'NMeM' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept valid museum MSI', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'MSI' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept on_display true', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': true }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept on_display false', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': false }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept invalid on_display', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': 'not a bool' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single location', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: 'London' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple location', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept array of multiple locations for json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: ['London', 'Portsmouth'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single birth[place]', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': 'London' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple birth[place]', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept multiple array of birth[place] as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': ['London', 'Portsmouth'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single occupation', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: 'Computer Programmer' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple occupation', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: ['Scientist', 'Computer Programmer'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept array of multiple occupations as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: ['Scientist', 'Computer Programmer'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single archive', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: 'The Babbage Archive' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple archive', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept array of multiple archives as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single formats', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: 'bound volume' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept multiple formats', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: ['bound volume', 'large format document', 'photograph'] }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept array of multiple formats as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: ['bound volume', 'large format document', 'photograph'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept single image_license', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'image_license': 'true' }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not accept array of multiple image_license as json', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'image_license': ['CC BY-NC-SA', 'CC BY-SA'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 400, 'Status code was as expected');
  t.end();
});

// AND logic for the filters
testWithServer(file + 'Number of filters for the occupation facet should be greater than 1', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/people?' + QueryString.stringify({ q: 'Lumière' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  const response = JSON.parse(res.payload);
  const test = response.meta.filters.organisation.length > 1;
  t.ok(test, 'The facet organisation has more than 1 filter');
  t.end();
});

// testWithServer(file + 'Number of filters for the occupation facet should be greater than 1', {}, async (t, ctx) => {
//   t.plan(1);
//
//   const htmlRequest = {
//     method: 'GET',
//     url: '/search/people?' + QueryString.stringify({ q: 'Lumière filmmaker' }),
//     headers: { Accept: 'application/vnd.api+json' }
//   };
//
//   const res = await ctx.server.inject(htmlRequest);
//     const response = JSON.parse(res.payload);
//     const test = response.meta.filters.occupation.length === 1;
//     t.equal(test, true, 'The facet occupation has now just 1 filter');
//     t.end();
//   });
// });

testWithServer(file + 'Should accept no query', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search',
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept params and no query', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'filter[date[from]]': '2016',
      'filter[places]': ['London', 'Bath']
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should accept user params', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'user': 'Great Central Railway'
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Should not return people or organisations as object type', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'q': 'Asbestos'
    }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.notOk(JSON.parse(res.payload).meta.filters.object_type.find(el => el.value === 'Turner Bros Asbestos Co'), 'Org does not appear in object type filter');
  t.end();
});

testWithServer(file + 'Should filter by has image', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'q': '',
      'filter[has_image]': 'true'
    }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(JSON.parse(res.payload).data.length > 0, 'returns some data with images');
  t.end();
});

testWithServer(file + 'Should have image and license facets', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'q': ''
    }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  var result = JSON.parse(res.payload);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(result.meta.filters.has_image[0].count >= result.meta.filters.image_license[0].count, 'more images than images with licenses');
  t.end();
});

testWithServer(file + 'Should filter by image tag cat - json', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/search/imgtag/cat' + QueryString.stringify({
      'q': ''
    }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  var result = JSON.parse(res.payload);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(result.length > 1, 'There is at least one image tag');
  t.end();
});

testWithServer(file + 'Should filter by image tag - html', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/imgtag/cat' + QueryString.stringify({
      'q': ''
    }),
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});
