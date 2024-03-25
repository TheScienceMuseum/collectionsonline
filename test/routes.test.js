const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const stub = require('sinon').stub;
const cache = require('../bin/cache.js');

testWithServer(file + 'Request for Archive HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Attempt to request for Archive HTML Page with wrong accept header',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/documents/aa110071448',
      headers: { Accept: 'wrongContent' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(
      res.statusCode,
      200,
      'Return HTML : Status code was as expected, 200'
    );
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Archive JSON Page', {}, async (t, ctx) => {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Request for Archive HTML Page for a wrong id',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/documents/aawrongid',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Archive HTML Page with expanded children',
  {},
  async (t, ctx) => {
    t.plan(1);

    const cacheStart = stub(cache, 'start').resolves();
    const cacheGet = stub(cache, 'get').resolves();

    const htmlRequest = {
      method: 'GET',
      url: '/documents/aa110000003?expanded=aa110000036',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    cacheStart.restore();
    cacheGet.restore();
    t.end();
  }
);

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co503905',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.end();
});

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co185953',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co129834',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co429651',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(res.payload.indexOf('<dd>Unidentified</dd>' > -1), '');
  await ctx.server.stop();
  t.end();
});

/* This is failing due to 'Unknown maker' no longer appeaing in index and should be fixed
testWithServer('Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co124',
    headers: {'Accept': 'text/html'}
  };

  const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('<dd>Unknown</dd>' > -1), '');
    await ctx.server.stop();
    t.end();
});
*/

testWithServer('Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co77088',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co77128',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Request for Object HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co62243',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(
  file + 'Request for Object HTML Page for a wrong id',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/objects/cowrongid',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Person HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp17351',
    headers: { Accept: 'text/html' },
  };
  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

testWithServer(
  file + "Request for Person HTML Page who doesn't exists",
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cpwrongid',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Person HTML Page with related items',
  {},
  async (t, ctx) => {
    t.plan(2);

    const htmlRequest = {
      method: 'GET',
      url: '/people/ap8',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('Babbage') > -1, 'Page loaded correctly');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Person JSON Page with no related items',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/people/ap24329',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Archive JSON', {}, async (t, ctx) => {
  t.plan(2);

  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110000003',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(
    res.headers['content-type'],
    'application/vnd.api+json',
    'JSONAPI response header should be application/vnd.api+json'
  );
  await ctx.server.stop();
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Request for Archive JSON with error',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/documents/aawrongid',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Object JSON Page', {}, async (t, ctx) => {
  t.plan(2);

  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co37959',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(
    res.headers['content-type'].indexOf('application/vnd.api+json') > -1,
    'JSONAPI response header should be application/vnd.api+json'
  );
  await ctx.server.stop();
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Request for Object JSON Page for a wrong id',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/objects/cowrongid',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Object Page with wrong accept headers',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/objects/co37959',
      headers: { Accept: 'wrongContent' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(
      res.statusCode,
      200,
      'Return HTML : Status code was as expected, 200'
    );
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Person JSON Page', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp17351',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.ok(
    res.headers['content-type'].indexOf('application/vnd.api+json') > -1,
    'JSONAPI response header should be application/vnd.api+json'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer(
  file + 'Request for Person JSON Page for a wrong id',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cpwrongid',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.ok(res.statusCode, 404, 'status is 404');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Person JSON Page with the wrong accept headers',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cp17351',
      headers: { Accept: 'wrongContent' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(
      res.statusCode,
      200,
      'Return HTML : Status code was as expected, 200'
    );
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for home JSON Page', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.ok(
    res.payload ===
      'See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api',
    'Response json home page ok'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('SCM Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/scm',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/science-museum',
    'redirects to search on Science Museum'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('NRM Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/nrm',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/national-railway-museum',
    'redirects to search on Railway Museum'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('NMEM Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/nmem',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/national-media-museum',
    'redirects to search on Media Museum'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('MSI Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/msi',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/museum-of-science-and-industry',
    'redirects to search on Museum of Science and Industry'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('Short url with bad request', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/msi?123=456',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 400, 'status is 400, bad request');
  await ctx.server.stop();
  t.end();
});

testWithServer('One gallery selected', {}, async (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/search?q=locomotive&filter[gallery]=Energy-Hall-Gallery',
    headers: { Accept: 'application/json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  const result = JSON.parse(res.payload).meta.filters.museum;
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(result.length, 1);
  t.equal(
    result[0].value,
    'Science Museum',
    'Selects relevant museum for gallery'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('Specific api endpoint', {}, async (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/co8094437',
    headers: { Accept: 'application/json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  const result = JSON.parse(res.payload);
  t.ok(res.statusCode, 200, 'status is 200');
  t.ok(result, 'Result was json');
  t.equal(
    result.data.attributes['@admin'].uid,
    'co8094437',
    'Correct object returned'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer(
  'Checking child records under SPH grouping on endpoint',
  {},
  async (t, ctx) => {
    t.plan(3);

    const htmlRequest = {
      method: 'GET',
      url: '/api/objects/co8094437',
      headers: { Accept: 'application/json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    const result = JSON.parse(res.payload);
    t.ok(res.statusCode, 200, 'status is 200');
    t.ok(result, 'Result was json');
    t.equal(
      result.data.children[0].data.attributes['@admin'].uid,
      'co8244487',
      'Correct object returned'
    );
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  'Checking child records are redirected back to their parent record',
  {},
  async (t, ctx) => {
    t.plan(2);

    const htmlRequest = {
      method: 'GET',
      url: '/objects/co8244487',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 301, 'status is  301, indicating redirection');
    t.ok(res.headers.location, 'Location header is present');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer('Specific api endpoint, html response', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/co8094437',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.ok(res.headers['content-type'].indexOf('text/html') > -1, 'html response');
  await ctx.server.stop();
  t.end();
});

testWithServer('non-existent api endpoint', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/cowrongid',
    headers: { Accept: 'application/json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 404, 'status is 404');
  await ctx.server.stop();
  t.end();
});

testWithServer('Multiple Makers', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co63869',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'status is ok');
  t.ok(
    res.payload.indexOf('Germany') > -1 && res.payload.indexOf('Spain') > -1,
    'Renders multiple makers correctly'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('Robot.txt route', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/robots.txt',
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'status is ok');
  t.ok(
    res.payload.indexOf('sitemap: ') > -1,
    'The /robot.txt contains the sitemap url'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('Restful Style Search Routes: html', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/categories/art',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'redirect status code');
  await ctx.server.stop();
  t.end();
});

testWithServer('Restful Style Search Routes: html', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/objects/categories/art',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'redirect status code');
  await ctx.server.stop();
  t.end();
});

testWithServer('Restful Style Search Routes: json', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/categories/art',
    headers: { Accept: 'application/json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'redirect status code');
  await ctx.server.stop();
  t.end();
});

testWithServer('Restful Style Search Routes: json', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/objects/categories/art',
    headers: { Accept: 'application/json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'redirect status code');
  await ctx.server.stop();
  t.end();
});

// testWithServer(file + 'Request for Related Articles from NSMM', {}, async (t, ctx) => {
//   const htmlRequest = {
//     method: 'GET',
//     url: '/articles/co18634',
//     headers: { 'Accept': 'application/json' }
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.ok(JSON.parse(res.payload), 'Result is JSON');
//   t.equal(res.statusCode, 200, 'Status code was as expected');
//   t.end();
// });

// testWithServer(file + 'Request for Related Articles from MSI', {}, async (t, ctx) => {
//   const htmlRequest = {
//     method: 'GET',
//     url: '/articles/co8406299',
//     headers: { 'Accept': 'application/json' }
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.ok(JSON.parse(res.payload), 'Result is JSON');
//   t.equal(res.statusCode, 200, 'Status code was as expected');
//   t.end();
// });

/*
testWithServer(file + 'iiif request', {}, async (t, ctx) => {
  const request = {
    method: 'GET',
    url: '/iiif/objects/co62243',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(request, (res) => {
    t.ok(JSON.parse(res.payload), 'Result is JSON');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
});
*/

testWithServer(file + 'Request for Results list page', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?page[type]=results-list',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.payload.indexOf('resultlist__info') > -1);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

// testWithServer(file + 'Request for Wikipedia Data', {}, async (t, ctx) => {
//   const htmlRequest = {
//     method: 'GET',
//     url: '/wiki/Albert_Einstein'
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   var result = JSON.parse(res.payload);
//   t.equal(result.url, 'https://en.wikipedia.org/wiki/Albert_Einstein', 'gets Einsteins wikipedia page');
//   t.ok(result.mainImage, 'returns an image from wikipedia');
//   t.equal(res.statusCode, 200, 'Status code was as expected');
//   await ctx.server.stop();
//   t.end();
// });

testWithServer(
  file + 'Request for Wikipedia in record Data',
  {},
  async (t, ctx) => {
    const htmlRequest = {
      method: 'GET',
      url: '/people/cp37054',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

/*
testWithServer(file + 'Request for Wikipedia Data with no image', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/wiki/Accession_number_(library_science)'
  };

  const res = await ctx.server.inject(htmlRequest);
    var result = JSON.parse(res.payload);
    t.equal(result.url, 'https://en.wikipedia.org/wiki/Accession_number_(library_science)', 'gets Accession_number_(library_science) Wikipedia page');
    t.notOk(result.mainImage, 'returns no image from wikipedia');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
});
*/

testWithServer(file + 'Not found', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/bad/request',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusMessage, 'Not Found');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Key category search', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?q=art',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.headers.location, '/search/categories/art');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'Key category search - synonym', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?q=telephones',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.headers.location, '/search/categories/telecommunications');
  await ctx.server.stop();
  t.end();
});

testWithServer(file + 'About', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/about',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('ABOUT') > -1);
  t.end();
});

testWithServer(file + 'Slideshow', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/categories/locomotives-and-rolling-stock-components/slideshow',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('slideshow') > -1);
  t.end();
});

testWithServer('Get all image tags: html', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/imgtags',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'status code ok');
  t.end();
});

testWithServer(
  file + 'Request for image tags JSON Page',
  {},
  async (t, ctx) => {
    t.plan(2);

    const htmlRequest = {
      method: 'GET',
      url: '/imgtags',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(
      res.headers['content-type'],
      'application/vnd.api+json',
      'JSONAPI response header ok'
    );
    t.end();
  }
);

testWithServer(
  file + 'Request for Person with non-creator related items',
  {},
  async (t, ctx) => {
    t.plan(2);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cp85708',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.result.included.length > 0);
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Person with creator related items',
  {},
  async (t, ctx) => {
    t.plan(2);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cp2735',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('/search/objects/makers') > -1);
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Person with no related items',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/people/cp88238',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

// mgroup tests

testWithServer(file + 'Request for Group HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/group/c81734',
    headers: { Accept: 'text/html' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Attempt to request for Group HTML Page with wrong accept header',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/group/c81734',
      headers: { Accept: 'wrongContent' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(
      res.statusCode,
      200,
      'Return HTML : Status code was as expected, 200'
    );
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(file + 'Request for Group JSON Page', {}, async (t, ctx) => {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/group/c81734',
    headers: { Accept: 'application/vnd.api+json' },
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  cacheStart.restore();
  cacheGet.restore();
  t.end();
});

testWithServer(
  file + 'Request for Group HTML Page for a wrong id',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/group/aawrongid',
      headers: { Accept: 'text/html' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);

testWithServer(
  file + 'Request for Group JSON with error',
  {},
  async (t, ctx) => {
    t.plan(1);

    const htmlRequest = {
      method: 'GET',
      url: '/group/aawrongid',
      headers: { Accept: 'application/vnd.api+json' },
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);
