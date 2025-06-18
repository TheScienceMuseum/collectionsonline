const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const stub = require('sinon').stub;
const cache = require('../bin/cache.js');
const fetchMock = require('fetch-mock');
global.fetch = fetchMock.sandbox();

testWithServer(file + 'Request for Archive HTML Page', {}, async (t, ctx) => {
  t.plan(1);

  const cacheStart = stub(cache, 'start').resolves();
  const cacheGet = stub(cache, 'get').resolves();

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: { Accept: 'text/html' }
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
      headers: { Accept: 'wrongContent' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'text/html' }
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
      headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
      headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
      headers: { Accept: 'text/html' }
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
      headers: { Accept: 'text/html' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'wrongContent' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'wrongContent' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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

testWithServer('NSMM Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/nsmm',
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/national-science-and-media-museum',
    'redirects to search on National Science and Media Museum'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('SIM Short url', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/sim',
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 200, 'status is 200');
  t.equal(
    res.headers.location,
    '/search/museum/science-and-industry-museum',
    'redirects to search on Science and Industry Museum'
  );
  await ctx.server.stop();
  t.end();
});

testWithServer('Short url with bad request', {}, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/msi?123=456',
    headers: { Accept: 'text/html' }
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
    url: '/search/museum/science-museum/gallery/information-age-gallery?q=Sony%20Trinitron',
    headers: { Accept: 'application/json' }
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
    headers: { Accept: 'application/json' }
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
      headers: { Accept: 'application/json' }
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
  'Checking deeply nested child records under SPH grouping',
  {},
  async (t, ctx) => {
    t.plan(3);

    const htmlRequest = {
      method: 'GET',
      url: '/api/objects/co134863',

      headers: { Accept: 'application/json' }
    };

    const res = await ctx.server.inject(htmlRequest);
    const result = JSON.parse(res.payload);
    t.ok(res.statusCode, 200, 'status is 200');
    t.ok(result, 'Result was json');
    t.equal(
      result?.data?.children?.[6]?.data?.attributes.child?.[0]?.['@admin'].uid,
      'co8917556',
      'Correct nested object returned'
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
      headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'application/json' }
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
    headers: { Accept: 'text/html' }
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
    url: '/robots.txt'
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'application/json' }
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
    headers: { Accept: 'application/json' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'redirect status code');
  await ctx.server.stop();
  t.end();
});

testWithServer(
  file + 'Request for Related Articles from NSMM',
  {},
  async (t, ctx) => {
    t.plan(2);
    const cacheStart = stub(cache, 'start').resolves();
    const cacheGet = stub(cache, 'get').resolves();

    const htmlRequest = {
      method: 'GET',
      url: '/articles/co18634',
      headers: { Accept: 'application/json' }
    };

    try {
      const res = await ctx.server.inject(htmlRequest);
      t.ok(JSON.parse(res.payload), 'Result is JSON');
      t.equal(res.statusCode, 200, 'Status code was as expected');
    } catch (error) {
      t.fail(error.message);
    } finally {
      await ctx.server.stop();
      cacheStart.restore();
      cacheGet.restore();
    }
    await ctx.server.stop();
    cacheStart.restore();
    cacheGet.restore();
  }
);

testWithServer(
  file + 'Request for Related Articles from MSI',
  {},
  async (t, ctx) => {
    t.plan(2);

    const cacheStart = stub(cache, 'start').resolves();
    const cacheGet = stub(cache, 'get').resolves();
    const htmlRequest = {
      method: 'GET',
      url: '/articles/co8406299',
      headers: { Accept: 'application/json' }
    };

    const res = await ctx.server.inject(htmlRequest);
    t.ok(JSON.parse(res.payload), 'Result is JSON');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    await ctx.server.stop();
    cacheStart.restore();
    cacheGet.restore();
    t.end();
  }
);

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
    headers: { Accept: 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.payload.indexOf('listresult__info') > -1);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  await ctx.server.stop();
  t.end();
});

// testWithServer('request to wikidata endpoint', {}, async (t, ctx) => {
//   // fetchMock.config.fallbackResponse = {
//   //   body: JSON.stringify({ error: 'Fallback response' }),
//   //   headers: { 'content-type': 'application/json' },
//   // };
//   fetchMock.mock(
//     'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q19837&format=json&languages=en&props=info%7Cclaims',
//     {
//       body: JSON.stringify({
//         entities: {
//           Q19837: {
//             entity: 'Q19837',
//             claims: {},
//             info: {},
//           },
//         },
//       }),
//       headers: { 'content-type': 'application/json' },
//     }
//   );
//   const htmlRequest = {
//     method: 'GET',
//     url: '/wiki/Q19837',
//     headers: { Accept: 'text/html' },
//   };

//   const res = await ctx.server.inject(htmlRequest);
//   t.equal(res.statusCode, 200, 'redirect status code');
//   await ctx.server.stop();
//   t.end();
//   fetchMock.restore();
// });

// testWithServer(file + 'Request for Wikidata', {}, async (t, ctx) => {
//   fetchMock.get(
//     'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q937&format=json&languages=en&props=info%7Cclaims%7Clabels',
//     {
//       body: JSON.stringify({
//         entities: {
//           Q937: {
//             claims: {
//               P18: [
//                 {
//                   mainsnak: {
//                     datavalue: {
//                       value:
//                         'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/https://upload.wikimedia.org/wikipedia/commons/d/d3/Albert_Einstein_Head.jpg',
//                     },
//                   },
//                 },
//               ],
//               P154: [],
//               P31: [
//                 {
//                   mainsnak: {
//                     datavalue: {
//                       value: { id: 'Q5' },
//                     },
//                   },
//                 },
//               ],
//             },
//           },
//         },
//       }),
//       headers: { 'Content-Type': 'application/json' },
//     }
//   );

//   const htmlRequest = {
//     method: 'GET',
//     url: '/wiki/Q937',
//   };
//   t.plan(2);

//   const res = await ctx.server.inject(htmlRequest);
//   const result = JSON.parse(res.payload);
//   t.equal(
//     result.P18,
//     'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/https://upload.wikimedia.org/wikipedia/commons/d/d3/Albert_Einstein_Head.jpg',
//     'gets Einsteins wikipedia page'
//   );
//   t.equal(res.statusCode, 200, 'Status code was as expected');
//   await ctx.server.stop();
//   t.end();
//   fetchMock.restore();
// });

testWithServer(
  'Request for nested wikidata and related fields',
  {},
  async (t, ctx) => {
    t.plan(2);

    const startCache = cache.start;
    cache.start = () => {};

    // Mock cache get
    const mockCacheData = {
      wikidata: {
        Q19837: {
          claims: {
            P108: [
              { mainsnak: { datavalue: { value: { id: 'Q312' } } } },
              { mainsnak: { datavalue: { value: { id: 'Q308993' } } } }
            ]
          }
        }
      }
    };
    const mockCacheGet = async (key) => {
      console.log('Cache get called with key:', key);
      if (key === 'wikidata') {
        console.log('Returning mock data:', mockCacheData);
        return mockCacheData;
      }
      console.log('Unknown key:', key);
      throw new Error(`Unknown key: ${key}`);
    };

    // Replace the original cache.get method
    cache.get = mockCacheGet;

    fetchMock.get(
      'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q19837&format=json&languages=en&props=info%7Cclaims%7Clabels',
      {
        body: JSON.stringify({
          entities: {
            Q19837: {
              claims: {
                P108: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: { id: 'Q312' }
                      }
                    }
                  },
                  {
                    mainsnak: {
                      datavalue: {
                        value: { id: 'Q308993' }
                      }
                    }
                  }
                ]
              }
            }
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    );

    fetchMock.get(
      'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q312&format=json&languages=en&props=info%7Cclaims%7Clabels',
      {
        body: JSON.stringify({
          entities: {
            Q312: {
              claims: {
                P373: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: { text: 'Apple Inc.' }
                      }
                    }
                  }
                ]
              }
            }
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    );

    fetchMock.get(
      'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q308993&format=json&languages=en&props=info%7Cclaims%7Clabels',
      {
        body: JSON.stringify({
          entities: {
            Q308993: {
              claims: {
                P373: [
                  {
                    mainsnak: {
                      datavalue: {
                        value: { text: 'NeXT' }
                      }
                    }
                  }
                ]
              }
            }
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const htmlRequest = {
      method: 'GET',
      url: '/wiki/Q19837'
    };

    const res = await ctx.server.inject(htmlRequest);

    const result = JSON.parse(res.payload);
    const expectedResult = {
      P108: {
        label: 'Employer(s)',
        value: [
          { related: 'http://localhost:8000/people/cp20600' },
          { related: 'http://localhost:8000/people/cp132685' }
        ]
      }
    };
    t.deepEqual(result.P108[0], expectedResult.P108[0]);
    t.equal(res.statusCode, 200, 'Status code was as expected');

    // Restore original cache.start
    cache.start = startCache;

    await ctx.server.stop();
    t.end();
    fetchMock.restore();
  }
);

testWithServer(file + 'Key category search - synonym', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?q=telephones',
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
    headers: { Accept: 'text/html' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'text/html' }
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
      headers: { Accept: 'application/vnd.api+json' }
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
    headers: { Accept: 'text/html' }
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
      headers: { Accept: 'wrongContent' }
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
    headers: { Accept: 'application/vnd.api+json' }
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
      headers: { Accept: 'text/html' }
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
      headers: { Accept: 'application/vnd.api+json' }
    };

    const res = await ctx.server.inject(htmlRequest);
    t.equal(res.statusCode, 404, 'Status code was as expected');
    await ctx.server.stop();
    t.end();
  }
);
