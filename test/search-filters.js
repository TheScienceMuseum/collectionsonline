const QueryString = require('querystring');
const testWithServer = require('./helpers/test-with-server');

testWithServer('Should accept params in filter[PARAM_NAME] format', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({
      'filter[date[from]]': '2016',
      'filter[places]': ['London', 'Bath']
    }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[from] in format YYYY', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[from]': '2016' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[from] in format YYYY-MM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[from]': '2016-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[from] in format YYYY-MM-DD', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[from]': '2016-12-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid date[from]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[from]': '2016-13-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[to] in format YYYY', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[to]': '2012' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[to] in format YYYY-MM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[to]': '2013-10' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept date[to] in format YYYY-MM-DD', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[to]': '2010-05-01' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid date[to]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'date[to]': '2016-02-31' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single places', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'places': 'London' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple places', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'places': ['London', 'Manchester'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single type', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'type': 'Model locomotive' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept multiple type', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'type': ['Model locomotive', 'Computer'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single makers', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'makers': 'Charles Babbage' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple makers', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'makers': ['Robert Stephenson', 'Charles Babbage'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single people', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'makers': 'Charles Babbage' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple people', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'makers': ['Robert Stephenson', 'Charles Babbage'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single organisations', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'organisations': 'Liverpool & Manchester Railway' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple organisations', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'organisations': ['Liverpool & Manchester Railway', 'Aquascutum Group plc'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single categories', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'categories': 'Locomotives' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple categories', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'categories': ['Locomotives', 'Rolling Stock'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept valid museum NRM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'museum': 'NRM' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept valid museum SMG', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'museum': 'SMG' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept valid museum NMeM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'museum': 'NMeM' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept valid museum MSI', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'museum': 'MSI' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid museum', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'museum': 'INVALID' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept on_display true', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'on_display': true }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept on_display false', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'on_display': false }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid on_display', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'on_display': 'not a bool' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single location', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'location': 'London' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept multiple location', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'location': ['London', 'Portsmouth'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single birth[place]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[place]': 'London' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept multiple birth[place]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[place]': ['London', 'Portsmouth'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept birth[date] in format YYYY', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[date]': '2016' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept birth[date] in format YYYY-MM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[date]': '2016-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept birth[date] in format YYYY-MM-DD', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[date]': '2016-12-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid birth[date]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'birth[date]': '2016-13-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept death[date] in format YYYY', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'death[date]': '2016' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept death[date] in format YYYY-MM', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'death[date]': '2016-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept death[date] in format YYYY-MM-DD', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'death[date]': '2016-12-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept invalid death[date]', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'death[date]': '2016-13-12' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single occupation', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'occupation': 'Computer Programmer' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept multiple occupation', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'occupation': ['Scientist', 'Computer Programmer'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single archive', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'archive': 'The Babbage Archive' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should not accept multiple archive', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'archive': ['The Babbage Archive', 'The Diplomas etc of Charles Babbage'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 400, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single formats', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'formats': 'bound volume' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple formats', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'formats': ['bound volume', 'large format document', 'photograph'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept single image_licences', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'image_licences': 'CC BY-NC-SA' }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Should accept multiple image_licences', (t, server) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?' + QueryString.stringify({ 'image_licences': ['CC BY-NC-SA', 'CC BY-SA'] }),
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});
