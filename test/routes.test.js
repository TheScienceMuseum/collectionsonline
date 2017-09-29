const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for Archive HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Attempt to request for Archive HTML Page with wrong accept header', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: {'Accept': 'wrongContent'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 406, 'Wrong accept header');
    t.end();
  });
});

testWithServer(file + 'Request for Archive JSON Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110071448',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Archive HTML Page for a wrong id', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aawrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

// testWithServer(file + 'Request for Archive HTML Page with expanded children', {}, (t, ctx) => {
//   t.plan(1);
//
//   const htmlRequest = {
//     method: 'GET',
//     url: '/documents/aa110000003?expanded=aa110000036',
//     headers: {'Accept': 'text/html'}
//   };
//
//   ctx.server.inject(htmlRequest, (res) => {
//     t.equal(res.statusCode, 200, 'Status code was as expected');
//     t.end();
//   });
// });

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co503905',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co185953',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co129834',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co429651',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('<dd>Unidentified</dd>' > -1), '');
    t.end();
  });
});

/* This is failing due to 'Unknown maker' no longer appeaing in index and should be fixed
testWithServer('Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co124',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('<dd>Unknown</dd>' > -1), '');
    t.end();
  });
});
*/

testWithServer('Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co77088',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co77128',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co62243',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page for a wrong id', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/cowrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Person HTML Page', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp17351',
    headers: {'Accept': 'text/html'}
  };
  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Person HTML Page who doesn\'t exists', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cpwrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Person HTML Page with related items', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/ap8',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.payload.indexOf('Babbage') > -1, 'Page loaded correctly');
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON Page with no related items', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/ap24329',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Archive JSON', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110000003',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(res.headers['content-type'], 'application/vnd.api+json', 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer(file + 'Request for Archive JSON with error', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aawrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object JSON Page', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co37959',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer(file + 'Request for Object JSON Page for a wrong id', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/cowrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Object Page with wrong accept headers', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/cowrongid',
    headers: {'Accept': 'wrongContent'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 406, 'Status code was as expected, 406');
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON Page', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp17351',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON Page for a wrong id', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cpwrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 404, 'status is 404');
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON Page with the wrong accept headers', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp17351',
    headers: {'Accept': 'wrongContent'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 406, 'Status code was as expected as 406');
    t.end();
  });
});

testWithServer(file + 'Request for home JSON Page', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.ok(res.payload === 'See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api', 'Response json home page ok');
    t.end();
  });
});

testWithServer('SCM Short url', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/scm',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.equal(res.headers.location, '/search/museum/science-museum', 'redirects to search on Science Museum');
    t.end();
  });
});

testWithServer('NRM Short url', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/nrm',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.equal(res.headers.location, '/search/museum/national-railway-museum', 'redirects to search on Railway Museum');
    t.end();
  });
});

testWithServer('NMEM Short url', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/nmem',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.equal(res.headers.location, '/search/museum/national-media-museum', 'redirects to search on Media Museum');
    t.end();
  });
});

testWithServer('MSI Short url', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/msi',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.equal(res.headers.location, '/search/museum/museum-of-science-and-industry', 'redirects to search on Museum of Science and Industry');
    t.end();
  });
});

testWithServer('Short url with bad request', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/msi?123=456',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 400, 'status is 400, bad request');
    t.end();
  });
});

testWithServer('One gallery selected', {}, (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/search?q=locomotive&filter[gallery]=Station-Hall',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload).meta.filters.museum;
    t.ok(res.statusCode, 200, 'status is 200');
    t.equal(result.length, 1);
    t.equal(result[0].value, 'National Railway Museum', 'Selects relevant museum for gallery');
    t.end();
  });
});

testWithServer('Specific api endpoint', {}, (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/co8094437',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload);
    t.ok(res.statusCode, 200, 'status is 200');
    t.ok(result, 'Result was json');
    t.equal(result.data.attributes.admin.uid, 'co8094437', 'Correct object returned');
    t.end();
  });
});

testWithServer('Specific api endpoint, html response', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/co8094437',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 200, 'status is 200');
    t.ok(res.headers['content-type'].indexOf('text/html') > -1, 'html response');
    t.end();
  });
});

testWithServer('non-existent api endpoint', {}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/api/objects/cowrongid',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'status is 404');
    t.end();
  });
});

testWithServer('Multiple Makers', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/co63869',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'status is ok');
    t.ok(res.payload.indexOf('Germany') > -1 && res.payload.indexOf('Spain') > -1, 'Renders multiple makers correctly');
    t.end();
  });
});

testWithServer('Robot.txt route', {}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/robots.txt'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'status is ok');
    t.ok(res.payload.indexOf('sitemap: ') > -1, 'The /robot.txt contains the sitemap url');
    t.end();
  });
});

testWithServer('Restful Style Search Routes: html', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/categories/art',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'redirect status code');
    t.end();
  });
});

testWithServer('Restful Style Search Routes: html', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/objects/categories/art',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'redirect status code');
    t.end();
  });
});

testWithServer('Restful Style Search Routes: json', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/categories/art',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'redirect status code');
    t.end();
  });
});

testWithServer('Restful Style Search Routes: json', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/objects/categories/art',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'redirect status code');
    t.end();
  });
});

testWithServer(file + 'Request for Related Articles from NSMM', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/articles/co18634',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(JSON.parse(res.payload), 'Result is JSON');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Related Articles from MSI', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/articles/co8406299',
    headers: {'Accept': 'application/json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(JSON.parse(res.payload), 'Result is JSON');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'rdf request', {}, (t, ctx) => {
  const request = {
    method: 'GET',
    url: '/objects/co62243',
    headers: {'Accept': 'application/rdf+xml'}
  };

  var regex = [
    /<attribute:object_type>.+<\/attribute:object_type>/,
    /<attribute:category>.+<\/attribute:category>/
  ];

  ctx.server.inject(request, (res) => {
    t.ok(regex.every(r => r.test(res.payload)));
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Results list page', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?page[type]=results-list',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.payload.indexOf('resultlist__info') > -1);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Wikipedia Data', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/wiki/Albert_Einstein'
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload);
    t.equal(result.url, 'https://en.wikipedia.org/wiki/Albert_Einstein', 'gets Einsteins wikipedia page');
    t.ok(result.mainImage, 'returns an image from wikipedia');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Wikipedia in record Data', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/people/cp37054',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'Request for Wikipedia Data with no image', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/wiki/Accession_number_(library_science)'
  };

  ctx.server.inject(htmlRequest, (res) => {
    var result = JSON.parse(res.payload);
    t.equal(result.url, 'https://en.wikipedia.org/wiki/Accession_number_(library_science)', 'gets Accession_number_(library_science) Wikipedia page');
    t.notOk(result.mainImage, 'returns no image from wikipedia');
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer(file + 'bad', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search/bad/request',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusMessage, 'Bad Request');
    t.end();
  });
});

testWithServer(file + 'Key category search', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?q=art',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.headers.location, '/search/categories/art');
    t.end();
  });
});

testWithServer(file + 'Key category search - synonym', {}, (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/search?q=telephones',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.headers.location, '/search/categories/telecommunications');
    t.end();
  });
});
