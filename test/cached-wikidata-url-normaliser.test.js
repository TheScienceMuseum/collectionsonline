'use strict';

// Tests for the read-time URL normaliser in cached-wikidata.js.
// The Wikidata cache is keyed by Q-code and shared between staging and
// production. Older code embedded `${config.rootUrl}` into URLs at write
// time, which leaked the writing environment's hostname through the
// cache. The normaliser strips those hostnames at read time when the path
// matches one of our internal route shapes — leaving external URLs
// (Wikidata, Wikipedia, VIAF, etc.) untouched.

const test = require('tape');
const { _normaliseInternalUrls: norm } = require('../lib/cached-wikidata');

test('normaliser: passes through nullish and primitive non-string values', function (t) {
  t.equal(norm(null), null);
  t.equal(norm(undefined), undefined);
  t.equal(norm(42), 42);
  t.equal(norm(true), true);
  t.end();
});

test('normaliser: leaves already-relative paths unchanged', function (t) {
  t.equal(norm('/people/cp52967'), '/people/cp52967');
  t.equal(norm('/objects/co8083260/foo'), '/objects/co8083260/foo');
  t.equal(norm('/search?q=foo'), '/search?q=foo');
  t.end();
});

test('normaliser: strips production hostname from internal-route URLs', function (t) {
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/people/cp52967'),
    '/people/cp52967'
  );
  t.equal(
    norm('http://collection.sciencemuseumgroup.org.uk/objects/co8083260'),
    '/objects/co8083260'
  );
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/documents/aa110000017'),
    '/documents/aa110000017'
  );
  t.end();
});

test('normaliser: strips arbitrary hostname (staging, EBS, localhost) from internal URLs', function (t) {
  t.equal(
    norm('http://collectionsonline-ai-biogs.eba-9hnswuq5.eu-west-1.elasticbeanstalk.com/people/cp1939'),
    '/people/cp1939'
  );
  t.equal(
    norm('http://localhost:8000/people/cp52967'),
    '/people/cp52967'
  );
  t.end();
});

test('normaliser: preserves query string and fragment when stripping', function (t) {
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/people/cp52967?foo=1'),
    '/people/cp52967?foo=1'
  );
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/objects/co8083260#section'),
    '/objects/co8083260#section'
  );
  t.end();
});

test('normaliser: leaves external URLs untouched', function (t) {
  // Wikidata / Wikipedia
  t.equal(
    norm('https://www.wikidata.org/wiki/Q937'),
    'https://www.wikidata.org/wiki/Q937'
  );
  t.equal(
    norm('https://en.wikipedia.org/wiki/Albert_Einstein'),
    'https://en.wikipedia.org/wiki/Albert_Einstein'
  );
  // External identifier services
  t.equal(
    norm('https://viaf.org/viaf/12345'),
    'https://viaf.org/viaf/12345'
  );
  t.equal(
    norm('https://www.gracesguide.co.uk/Smith'),
    'https://www.gracesguide.co.uk/Smith'
  );
  // Wikimedia Commons (image hosting for wiki blocks)
  t.equal(
    norm('https://commons.wikimedia.org/wiki/File:foo.jpg'),
    'https://commons.wikimedia.org/wiki/File:foo.jpg'
  );
  t.end();
});

test('normaliser: leaves URLs with non-internal paths alone, even on our hostname', function (t) {
  // Our hostname BUT the path doesn't match an internal-record shape —
  // could be a static asset URL or a marketing link. Don't touch.
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/about'),
    'https://collection.sciencemuseumgroup.org.uk/about'
  );
  t.equal(
    norm('https://collection.sciencemuseumgroup.org.uk/assets/img/logo.svg'),
    'https://collection.sciencemuseumgroup.org.uk/assets/img/logo.svg'
  );
  t.end();
});

test('normaliser: leaves URLs whose path coincidentally contains "/people/" but no UID', function (t) {
  // Defensive check — INTERNAL_ROUTE_RE requires the prefix is followed
  // by a known UID scheme (cp/ap/co/aa/ag).
  t.equal(
    norm('https://example.com/people/famous-folks'),
    'https://example.com/people/famous-folks'
  );
  t.equal(
    norm('https://example.com/objects/by-decade'),
    'https://example.com/objects/by-decade'
  );
  t.end();
});

test('normaliser: walks arrays and strips internal URLs in nested entries', function (t) {
  const input = [
    { url: 'https://collection.sciencemuseumgroup.org.uk/people/cp1', name: 'Alice' },
    { url: 'https://collection.sciencemuseumgroup.org.uk/objects/co2', name: 'Bob' },
    { url: 'https://en.wikipedia.org/wiki/Bob', name: 'External' }
  ];
  const out = norm(input);
  t.equal(out[0].url, '/people/cp1');
  t.equal(out[1].url, '/objects/co2');
  t.equal(out[2].url, 'https://en.wikipedia.org/wiki/Bob', 'external untouched');
  t.end();
});

test('normaliser: walks deeply nested objects', function (t) {
  // Mirrors the actual cached Wikidata response shape — values is an
  // array of objects, each with potentially internal `url` or `related`
  // fields plus external `wikidataUrl` / `wikipediaUrl`.
  const input = {
    wikidataUrl: 'https://www.wikidata.org/wiki/Q937',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein',
    values: [
      {
        label: 'employer',
        related: 'http://localhost:8000/people/cp4566',
        value: 'ETH Zurich'
      },
      {
        label: 'colleagues',
        list: [
          { name: 'Alice', url: 'https://collection.sciencemuseumgroup.org.uk/people/cp10' },
          { name: 'Bob', url: 'https://collection.sciencemuseumgroup.org.uk/people/cp11' }
        ]
      }
    ]
  };
  const out = norm(input);
  // External URLs untouched
  t.equal(out.wikidataUrl, 'https://www.wikidata.org/wiki/Q937');
  t.equal(out.wikipediaUrl, 'https://en.wikipedia.org/wiki/Albert_Einstein');
  // Internal URLs stripped, regardless of which environment wrote them
  t.equal(out.values[0].related, '/people/cp4566');
  t.equal(out.values[1].list[0].url, '/people/cp10');
  t.equal(out.values[1].list[1].url, '/people/cp11');
  t.end();
});

test('normaliser: handles unparseable URL strings gracefully', function (t) {
  // Ensure URL-parse failures don't blow up the cache read path.
  t.equal(norm('http://'), 'http://');
  t.equal(norm('http:///bad'), 'http:///bad', 'unparseable left as-is');
  t.end();
});

test('normaliser: handles empty string', function (t) {
  t.equal(norm(''), '');
  t.end();
});
