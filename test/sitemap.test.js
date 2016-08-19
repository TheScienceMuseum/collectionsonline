const Fs = require('fs');
const Path = require('path');
const Hapi = require('hapi');
const test = require('tape');
const file = require('path').relative(process.cwd(), __filename) + ' > ';
const createMockDatabase = require('./helpers/mock-database');
const createServer = require('../server');
const config = require('../config');

test(file + 'Should proxy to sitemap', (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const upstream = new Hapi.Server();
  upstream.connection();
  upstream.register(require('inert'), () => {});
  upstream.route({
    method: 'GET',
    path: '/sitemap.xml',
    handler: (request, reply) => reply.file(sitemapPath)
  });

  upstream.start(() => {
    // Set sitemap URL to upstream
    const testConfig = Object.assign({}, config, {
      sitemapUrl: `http://localhost:${upstream.info.port}`
    });

    createServer(createMockDatabase(), testConfig, (err, ctx) => {
      t.ifError(err, 'No error creating server');

      const request = {
        method: 'GET',
        url: '/sitemap.xml'
      };

      ctx.server.inject(request, (res) => {
        t.equal(res.statusCode, 200, 'Status was OK');
        t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
        upstream.stop();
        t.end();
      });
    });
  });
});

test(file + 'Should serve local sitemap if no sitemap URL configured', (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const testConfig = Object.assign({}, config, { sitemapUrl: '' });

  createServer(createMockDatabase(), testConfig, (err, ctx) => {
    t.ifError(err, 'No error creating server');

    const request = {
      method: 'GET',
      url: '/sitemap.xml'
    };

    ctx.server.inject(request, (res) => {
      t.equal(res.statusCode, 200, 'Status was OK');
      t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
      t.end();
    });
  });
});

test(file + 'Should serve local sitemap if sitemap URL is same as base URL', (t) => {
  t.plan(3);

  const sitemapPath = Path.join(__dirname, '..', 'public', 'sitemap.xml');
  const sitemapXml = Fs.readFileSync(sitemapPath, 'utf8');

  const testConfig = Object.assign({}, config, { sitemapUrl: config.baseUrl });

  createServer(createMockDatabase(), testConfig, (err, ctx) => {
    t.ifError(err, 'No error creating server');

    const request = {
      method: 'GET',
      url: '/sitemap.xml'
    };

    ctx.server.inject(request, (res) => {
      t.equal(res.statusCode, 200, 'Status was OK');
      t.equal(res.payload, sitemapXml, 'Sitemap XML was sent');
      t.end();
    });
  });
});
