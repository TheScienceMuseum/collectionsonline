const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for Archive HTML Page', (t, { server }) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-110000316',
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Archivedoc HTML Page', (t, { server }) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/archivedoc',
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Object HTML Page', (t, { server }) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-37959',
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Person HTML Page', (t, { server }) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-agents-17351',
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.end();
  });
});

testWithServer('Request for Archive JSON', (t, { server }) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-110069402',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Archivedoc JSON', (t, { server }) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/archivedoc',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Object JSON Page', (t, { server }) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-37959',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for Person JSON Page', (t, { server }) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-17351',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});
