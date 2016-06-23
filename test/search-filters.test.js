const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');

testWithServer('Should accept params in filter[PARAM_NAME] format', (t, ctx) => {
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

testWithServer('Should accept date[from] in format YYYY', (t, ctx) => {
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

testWithServer('Should accept date[from] in format YYYY-MM', (t, ctx) => {
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

testWithServer('Should accept date[from] in format YYYY-MM-DD', (t, ctx) => {
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

testWithServer('Should not accept invalid date[from]', (t, ctx) => {
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

testWithServer('Should accept date[to] in format YYYY', (t, ctx) => {
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

testWithServer('Should accept date[to] in format YYYY-MM', (t, ctx) => {
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

testWithServer('Should accept date[to] in format YYYY-MM-DD', (t, ctx) => {
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

testWithServer('Should not accept invalid date[to]', (t, ctx) => {
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

testWithServer('Should accept single places', (t, ctx) => {
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

testWithServer('Should accept multiple places', (t, ctx) => {
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

testWithServer('Should accept single type', (t, ctx) => {
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

testWithServer('Should not accept multiple type', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', type: ['Model locomotive', 'Computer'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single makers', (t, ctx) => {
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

testWithServer('Should accept multiple makers', (t, ctx) => {
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

testWithServer('Should accept single people', (t, ctx) => {
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

testWithServer('Should accept multiple people', (t, ctx) => {
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

testWithServer('Should accept single organisations', (t, ctx) => {
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

testWithServer('Should accept multiple organisations', (t, ctx) => {
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

testWithServer('Should accept single categories', (t, ctx) => {
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

testWithServer('Should accept multiple categories', (t, ctx) => {
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

testWithServer('Should accept valid museum NRM', (t, ctx) => {
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

testWithServer('Should accept valid museum SMG', (t, ctx) => {
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

testWithServer('Should accept valid museum NMeM', (t, ctx) => {
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

testWithServer('Should accept valid museum MSI', (t, ctx) => {
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

testWithServer('Should not accept invalid museum', (t, ctx) => {
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

testWithServer('Should accept on_display true', (t, ctx) => {
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

testWithServer('Should accept on_display false', (t, ctx) => {
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

testWithServer('Should not accept invalid on_display', (t, ctx) => {
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

testWithServer('Should accept single location', (t, ctx) => {
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

testWithServer('Should not accept multiple location', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', location: ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single birth[place]', (t, ctx) => {
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

testWithServer('Should not accept multiple birth[place]', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', 'birth[place]': ['London', 'Portsmouth'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept birth[date] in format YYYY', (t, ctx) => {
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

testWithServer('Should accept birth[date] in format YYYY-MM', (t, ctx) => {
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

testWithServer('Should accept birth[date] in format YYYY-MM-DD', (t, ctx) => {
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

testWithServer('Should not accept invalid birth[date]', (t, ctx) => {
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

testWithServer('Should accept death[date] in format YYYY', (t, ctx) => {
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

testWithServer('Should accept death[date] in format YYYY-MM', (t, ctx) => {
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

testWithServer('Should accept death[date] in format YYYY-MM-DD', (t, ctx) => {
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

testWithServer('Should not accept invalid death[date]', (t, ctx) => {
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

testWithServer('Should accept single occupation', (t, ctx) => {
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

testWithServer('Should not accept multiple occupation', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', occupation: ['Scientist', 'Computer Programmer'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single archive', (t, ctx) => {
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

testWithServer('Should not accept multiple archive', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ q: 'test', archive: ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: { Accept: 'text/html' }
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single formats', (t, ctx) => {
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

testWithServer('Should accept multiple formats', (t, ctx) => {
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

testWithServer('Should accept single image_licences', (t, ctx) => {
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

testWithServer('Should accept multiple image_licences', (t, ctx) => {
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
