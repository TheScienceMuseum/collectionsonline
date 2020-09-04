const Fs = require('fs');
const Path = require('path');
const Hapi = require('@hapi/hapi');
const test = require('tape');
const file = require('path').relative(process.cwd(), __filename) + ' > ';
const createMockDatabase = require('./helpers/mock-database');
const createServer = require('../server');
const config = require('../config');

test(file + 'Should proxy to sitemap', async (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const upstream = new Hapi.Server();

  await upstream.register(require('inert'));
  upstream.route({
    method: 'GET',
    path: '/sitemap.xml',
    handler: (request, h) => h.file(sitemapPath)
  });

  await upstream.start();

  // Set sitemap URL to upstream
  const testConfig = Object.assign({}, config, {
    sitemapUrl: `http://localhost:${upstream.info.port}`
  });

  createServer(createMockDatabase(), testConfig, async (err, ctx) => {
    t.ifError(err, 'No error creating server');

    const request = {
      method: 'GET',
      url: '/sitemap.xml'
    };

    const res = await ctx.server.inject(request);
    t.equal(res.statusCode, 200, 'Status was OK');
    t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
    await upstream.stop();
    t.end();
  });
});

test(file + 'Should serve local sitemap if no sitemap URL configured', (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const testConfig = Object.assign({}, config, { sitemapUrl: '' });

  createServer(createMockDatabase(), testConfig, async (err, ctx) => {
    t.ifError(err, 'No error creating server');

    const request = {
      method: 'GET',
      url: '/sitemap.xml'
    };

    const res = await ctx.server.inject(request);
    t.equal(res.statusCode, 200, 'Status was OK');
    t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
    t.end();
  });
});

test(file + 'Should serve local sitemap if sitemap URL is same as base URL', (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const testConfig = Object.assign({}, config, { sitemapUrl: config.baseUrl });

  createServer(createMockDatabase(), testConfig, async (err, ctx) => {
    t.ifError(err, 'No error creating server');

    const request = {
      method: 'GET',
      url: '/sitemap.xml'
    };

    const res = await ctx.server.inject(request);
    t.equal(res.statusCode, 200, 'Status was OK');
    t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
    t.end();
  });
});
