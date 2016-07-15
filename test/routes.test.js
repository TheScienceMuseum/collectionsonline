const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Archive HTML Page', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-110000316',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Archive HTML Page for a wrong id', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-wrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Archive HTML Page but receive bad request from es', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected t0 503');
    t.end();
  });
});

testWithServer('Request for Archivedoc HTML Page', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/archivedoc',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Object HTML Page', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-37959',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Object HTML Page for a wrong id', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-wrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Object HTML Page but get error 503', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected to 503');
    t.end();
  });
});

testWithServer('Request for Person HTML Page', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-17351',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Person HTML Page who doesn\'t exists', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-wrongid',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Person HTML Page but get error 503', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected to 503');
    t.end();
  });
});

testWithServer('Request for Archive JSON', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-110000003',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Archive JSON with error', (t, ctx) => {
  t.plan(4);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-wrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(response.status, 404, 'status is 404');
    t.ok(response.displayName, 'NotFound', 'the archive is not found');
    t.ok(response.message, 'Not Found', 'the archive message is not found');
    t.end();
  });
});

testWithServer('Request for Archive JSON with no result', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-noResult',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.ok(response.errors[0].detail, 404, 'Archive not found');
    t.end();
  });
});

testWithServer('Request for Archivedoc JSON', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/archivedoc',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Object JSON Page', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-37959',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Object JSON Page for a wrong id', (t, ctx) => {
  t.plan(4);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-wrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(response.status, 404, 'status is 404');
    t.ok(response.displayName, 'NotFound', 'the object is not found');
    t.ok(response.message, 'Not Found', 'the object message is not found');
    t.end();
  });
});

testWithServer('Request for Object JSON Page, not found', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-noResult',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.ok(response.errors[0].detail, 404, 'Object not found');
    t.end();
  });
});

testWithServer('Request for Person JSON Page', (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-17351',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Person JSON Page for a wrong id', (t, ctx) => {
  t.plan(3);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-wrongid',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.ok(response.status, 404, 'status is 404');
    t.ok(response.displayName, 'NotFound', 'the person is not found');
    t.ok(response.message, 'Not Found', 'the person message is not found');
    t.end();
  });
});

testWithServer('Request for Person JSON Page, no result', (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-noResult',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    // {"errors":[{"title":"Not Found","status":404,"detail":"Person not found"}]}
    var response = JSON.parse(res.payload);
    t.ok(response.errors[0].detail, 404, 'Person not found');
    t.end();
  });
});
