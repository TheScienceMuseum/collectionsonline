const testWithServer = require('./helpers/test-with-server');
const fs = require('fs');
const jsFile = fs.readFileSync('public/bundle.js');
const cssFile = fs.readFileSync('public/bundle.css');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Javascript Files served correctly', {}, (t, ctx) => {
  t.plan(1);

  const jsRequest = {
    method: 'GET',
    url: '/bundle.js'
  };

  ctx.server.inject(jsRequest, (res) => {
    t.equal(res.payload.toString('utf-8'), jsFile.toString(), 'JS File should be served');
    t.end();
  });
});

testWithServer(file + 'CSS Files served correctly', {}, (t, ctx) => {
  t.plan(1);

  const cssRequest = {
    method: 'GET',
    url: '/bundle.css'
  };

  ctx.server.inject(cssRequest, function (res) {
    t.equal(res.payload.toString('utf-8'), cssFile.toString(), 'CSS file should be served');
    t.end();
  });
});

testWithServer(file + 'Non Existent Files', {}, (t, ctx) => {
  t.plan(1);

  const badRequest = {
    method: 'GET',
    url: '/notfound.js'
  };

  ctx.server.inject(badRequest, (res) => {
    t.equal(res.statusCode, 404, 'Non-existent file should return 404');
    t.end();
  });
});
