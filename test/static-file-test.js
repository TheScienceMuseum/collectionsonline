const testWithServer = require('./helpers/test-with-server');
const fs = require('fs');
const jsFile = fs.readFileSync('public/bundle.js');
const cssFile = fs.readFileSync('public/bundle.css');

testWithServer('Javascript Files served correctly', (t, { server }) => {
  t.plan(1);

  const jsRequest = {
    method: 'GET',
    url: '/bundle.js'
  };

  server.inject(jsRequest, (res) => {
    t.equal(res.payload.toString('utf-8'), jsFile.toString(), 'JS File should be served');
    t.end();
  });
});

testWithServer('CSS Files served correctly', (t, { server }) => {
  t.plan(1);

  const cssRequest = {
    method: 'GET',
    url: '/bundle.css'
  };

  server.inject(cssRequest, function (res) {
    t.equal(res.payload.toString('utf-8'), cssFile.toString(), 'CSS file should be served');
    t.end();
  });
});

testWithServer('Non Existent Files', (t, { server }) => {
  t.plan(1);

  const badRequest = {
    method: 'GET',
    url: '/notfound.js'
  };

  server.inject(badRequest, (res) => {
    t.equal(res.statusCode, 404, 'Non-existent file should return 404');
    t.end();
  });
});
