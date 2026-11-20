const testWithServer = require('./helpers/test-with-server');
const fs = require('fs');
const path = require('path');
const jsFile = fs.readFileSync('public/bundle.js');
const cssFile = fs.readFileSync('public/bundle.css');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Javascript Files served correctly', {}, async (t, ctx) => {
  t.plan(1);

  const jsRequest = {
    method: 'GET',
    url: '/bundle.js'
  };

  const res = await ctx.server.inject(jsRequest);
  t.equal(res.payload.toString('utf-8'), jsFile.toString(), 'JS File should be served');
  t.end();
});

testWithServer(file + 'CSS Files served correctly', {}, async (t, ctx) => {
  t.plan(1);

  const cssRequest = {
    method: 'GET',
    url: '/bundle.css'
  };

  const res = await ctx.server.inject(cssRequest);
  t.equal(res.payload.toString('utf-8'), cssFile.toString(), 'CSS file should be served');
  t.end();
});

testWithServer(file + 'An old bundle hash from before a deploy serves the current bundle instead of 404', {}, async (t, ctx) => {
  t.plan(5);

  const js = await ctx.server.inject({ method: 'GET', url: '/bundle-deadbeef.js' });
  t.equal(js.statusCode, 200, 'old JS hash is not a 404');
  t.equal(js.payload, jsFile.toString(), 'current JS served');
  t.match(js.headers['cache-control'], /max-age=300\b/, 'cached only briefly');

  const css = await ctx.server.inject({ method: 'GET', url: '/bundle-deadbeef.css' });
  t.equal(css.payload, cssFile.toString(), 'current CSS served for an old CSS hash');

  const notHash = await ctx.server.inject({ method: 'GET', url: '/bundle-notahash.js' });
  t.equal(notHash.statusCode, 404, 'names that are not bundle hashes still 404');
});

testWithServer(file + 'A bundle hash that still exists is served as is', {}, async (t, ctx) => {
  t.plan(2);
  const kept = path.join(__dirname, '..', 'public', 'bundle-00000000.js');
  fs.writeFileSync(kept, '/* kept build */');
  try {
    const res = await ctx.server.inject({ method: 'GET', url: '/bundle-00000000.js' });
    t.equal(res.statusCode, 200, 'served');
    t.equal(res.payload, '/* kept build */', 'the kept build, not the current one');
  } finally {
    fs.unlinkSync(kept);
  }
});

testWithServer(file + 'Non Existent Files', {}, async (t, ctx) => {
  t.plan(1);

  const badRequest = {
    method: 'GET',
    url: '/notfound.js'
  };

  const res = await ctx.server.inject(badRequest);
  t.equal(res.statusCode, 404, 'Non-existent file should return 404');
  t.end();
});
