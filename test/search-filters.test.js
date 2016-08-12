const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Should accept params in filter[PARAM_NAME] format', (t, ctx) => {
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

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[from] in format YYYY', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[from] in format YYYY-MM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[from] in format YYYY-MM-DD', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-12-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid date[from]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[from]': '2016-13-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[to] in format YYYY', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2012' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[to] in format YYYY-MM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2013-10' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept date[to] in format YYYY-MM-DD', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2010-05-01' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid date[to]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'date[to]': '2016-02-31' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single places for html', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single places for json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple places for html', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: ['London', 'Manchester'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept multiple places as array for json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: ['London', 'Manchester'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple places as csv for json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', places: 'London,Manchester' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single type', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', type: 'Model locomotive' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single type as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', type: 'Model locomotive' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple types', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', type: ['Model locomotive', 'Computer'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept array of types as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', type: ['Model locomotive', 'Computer'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single makers', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: 'Charles Babbage' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple makers', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: ['Robert Stephenson', 'Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single people', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: 'Charles Babbage' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple people', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', makers: ['Robert Stephenson', 'Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single organisations', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', organisations: 'Liverpool & Manchester Railway' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple organisations', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', organisations: ['Liverpool & Manchester Railway', 'Aquascutum Group plc'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single categories', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', categories: 'Locomotives' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple categories', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', categories: ['Locomotives', 'Rolling Stock'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept valid museum NRM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'NRM' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept valid museum SMG', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'SMG' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept valid museum NMeM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'NMeM' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept valid museum MSI', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'MSI' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid museum', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', museum: 'INVALID' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept on_display true', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': true }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept on_display false', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': false }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid on_display', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'on_display': 'not a bool' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single location', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: 'London' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple location', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept array of multiple locations for json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: ['London', 'Portsmouth'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single birth[place]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': 'London' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple birth[place]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept multiple array of birth[place] as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': ['London', 'Portsmouth'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept birth[date] in format YYYY', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[date]': '2016' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept birth[date] in format YYYY-MM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[date]': '2016-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept birth[date] in format YYYY-MM-DD', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[date]': '2016-12-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid birth[date]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[date]': '2016-13-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept death[date] in format YYYY', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'death[date]': '2016' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept death[date] in format YYYY-MM', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'death[date]': '2016-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept death[date] in format YYYY-MM-DD', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'death[date]': '2016-12-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept invalid death[date]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'death[date]': '2016-13-12' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single occupation', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: 'Computer Programmer' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple occupation', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: ['Scientist', 'Computer Programmer'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept array of multiple occupations as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: ['Scientist', 'Computer Programmer'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single archive', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: 'The Babbage Archive' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple archive', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept array of multiple archives as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single formats', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: 'bound volume' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple formats', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: ['bound volume', 'large format document', 'photograph'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept array of multiple formats as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', formats: ['bound volume', 'large format document', 'photograph'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept single image_licences', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'image_licences': 'CC BY-NC-SA' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept multiple image_licences', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'image_licences': ['CC BY-NC-SA', 'CC BY-SA'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should not accept array of multiple image_licences as json', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'image_licences': ['CC BY-NC-SA', 'CC BY-SA'] }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should return an error if the elasticsearch search function fail', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    // mock-database trigger an error if the query parameter is equal to "error"
    url: '/search?' + QueryString.stringify({ q: 'error' }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected to 400');
    t.end();
  });
});

testWithServer(file + 'Should return an error if the elasticsearch search function fail on json request', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'error' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    const response = JSON.parse(res.payload);
    t.equal(res.statusCode, 400, 'Status code was as expected to 400');
    t.equal(response.errors[0].title, 'Bad Request', 'the title of the error is Bad Request');
    t.end();
  });
});

// AND logic for the filters
testWithServer(file + 'Number of filters for the occupation facet should be greater than 1', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/people?' + QueryString.stringify({ q: 'Lumière' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    const response = JSON.parse(res.payload);
    const test = response.meta.filters.occupation.length > 1;
    t.equal(test, true, 'The facet occupation has more than 1 filter');
    t.end();
  });
});

testWithServer(file + 'Number of filters for the occupation facet should be greater than 1', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search/people?' + QueryString.stringify({ q: 'Lumière filmmaker' }),
    headers: { Accept: 'application/vnd.api+json' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    const response = JSON.parse(res.payload);
    const test = response.meta.filters.occupation.length === 1;
    t.equal(test, true, 'The facet occupation has now just 1 filter');
    t.end();
  });
});

testWithServer(file + 'Should accept no query', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search',
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Should accept params and no query', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'filter[date[from]]': '2016',
      'filter[places]': ['London', 'Bath']
    }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});
