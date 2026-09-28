'use strict';

// Tests for the claim signature module — the identity function that
// lets curator decisions and reviewer findings match onto newly-
// generated sentences across biography regenerations.

const test = require('tape');
const {
  normalise,
  tokenize,
  signature,
  similarity,
  similarityDetail
} = require('../lib/ai/claim-signature');

// --- normalise --------------------------------------------------------

test('normalise: lowercase + collapse whitespace + strip punctuation', function (t) {
  t.equal(
    normalise('Einstein worked at the Swiss Patent Office.'),
    'einstein worked at the swiss patent office',
    'sentence-terminating punctuation stripped'
  );
  t.equal(
    normalise('Einstein   worked  at\tthe Swiss Patent Office'),
    'einstein worked at the swiss patent office',
    'multiple spaces / tabs collapsed to single space'
  );
  t.equal(
    normalise('  Einstein worked at the Swiss Patent Office  '),
    'einstein worked at the swiss patent office',
    'leading/trailing whitespace trimmed'
  );
  t.end();
});

test('normalise: curly quotes normalise to straight', function (t) {
  t.equal(
    normalise('Einstein said "everything is relative"'),
    normalise('Einstein said “everything is relative”'),
    'curly double quotes → straight'
  );
  t.equal(
    normalise("Einstein's job at the Patent Office"),
    normalise('Einstein’s job at the Patent Office'),
    'curly single quotes → straight'
  );
  t.end();
});

test('normalise: preserves letters + digits across scripts', function (t) {
  t.equal(normalise('Hans Christian Ørsted'), 'hans christian ørsted');
  t.equal(normalise('München, 1879'), 'münchen 1879');
  t.end();
});

test('normalise: null / undefined / empty safe', function (t) {
  t.equal(normalise(null), '');
  t.equal(normalise(undefined), '');
  t.equal(normalise(''), '');
  t.equal(normalise(42), '42', 'number coerced to string');
  t.end();
});

// --- tokenize --------------------------------------------------------

test('tokenize: strips stopwords, punctuation, short tokens', function (t) {
  const toks = tokenize('The Swiss Patent Office in Bern.');
  t.equal(toks.has('the'), false, 'stopword dropped');
  t.equal(toks.has('in'), false, 'short token dropped');
  t.equal(toks.has('swiss'), true);
  t.equal(toks.has('patent'), true);
  t.equal(toks.has('office'), true);
  t.equal(toks.has('bern'), true);
  t.end();
});

test('tokenize: null / empty / non-string safe', function (t) {
  t.equal(tokenize(null).size, 0);
  t.equal(tokenize('').size, 0);
  t.equal(tokenize(undefined).size, 0);
  t.equal(tokenize(42).size, 0);
  t.end();
});

// --- signature -------------------------------------------------------

test('signature: identical claims produce identical signature', function (t) {
  t.equal(
    signature('Einstein worked at the Swiss Patent Office'),
    signature('Einstein worked at the Swiss Patent Office')
  );
  t.end();
});

test('signature: stable across whitespace + case + punctuation variants', function (t) {
  const a = signature('Einstein worked at the Swiss Patent Office.');
  const b = signature('einstein worked at the swiss patent office');
  const c = signature('  EINSTEIN worked at the Swiss Patent Office!  ');
  t.equal(a, b, 'punctuation + case variants collide');
  t.equal(a, c, 'whitespace + case variants collide');
  t.end();
});

test('signature: word-order-insensitive (sorted-token hashing)', function (t) {
  // This is the key property that makes v2 signatures more robust than
  // v1's raw-string hash: a re-ordered claim about the same fact
  // produces the same signature.
  const a = signature('Einstein worked at the Swiss Patent Office');
  const b = signature('worked at the Swiss Patent Office Einstein');
  t.equal(a, b, 'word-order variants collide onto same signature');
  t.end();
});

test('signature: different underlying claims produce different signatures', function (t) {
  t.notEqual(
    signature('Einstein worked at the Swiss Patent Office'),
    signature('Einstein worked at the University of Zurich'),
    'different content → different signature'
  );
  t.end();
});

test('signature: output shape is 16 lowercase hex chars', function (t) {
  const sig = signature('any claim text at all');
  t.equal(sig.length, 16);
  t.ok(/^[0-9a-f]{16}$/.test(sig));
  t.end();
});

test('signature: empty / null still hashes deterministically', function (t) {
  t.equal(signature(''), signature(null), 'null and empty collide');
  t.equal(signature('').length, 16);
  t.end();
});

// --- similarity ------------------------------------------------------

test('similarity: identical claims score 1', function (t) {
  t.equal(
    similarity(
      'Einstein worked at the Swiss Patent Office',
      'Einstein worked at the Swiss Patent Office'
    ),
    1
  );
  t.end();
});

test('similarity: unrelated claims score near 0', function (t) {
  const s = similarity(
    'Einstein worked at the Swiss Patent Office',
    'Charles Darwin voyaged aboard HMS Beagle'
  );
  t.ok(s < 0.2, 'unrelated → low similarity: got ' + s);
  t.end();
});

test('similarity: containment case scores high', function (t) {
  const shortClaim = 'Swiss Federal Institute of Intellectual Property';
  const longClaim = 'took a post at the Swiss Federal Institute of Intellectual Property in Bern in 1902';
  t.ok(
    similarity(shortClaim, longClaim) >= 0.8,
    'shorter claim mostly contained in longer → high similarity'
  );
  t.end();
});

test('similarity: null / empty pairs score 0 without crashing', function (t) {
  t.equal(similarity('', 'anything'), 0);
  t.equal(similarity(null, null), 0);
  t.equal(similarity('anything', ''), 0);
  t.end();
});

// --- similarityDetail ------------------------------------------------

test('similarityDetail: returns { ratio, intersection } for gating', function (t) {
  const d = similarityDetail(
    'Einstein worked at the Swiss Patent Office',
    'Einstein worked at the Swiss Patent Office'
  );
  t.equal(d.ratio, 1);
  t.ok(d.intersection >= 3);
  t.end();
});

test('similarityDetail: intersection exposed so callers can guard trivial matches', function (t) {
  // Two-token overlap should have intersection <= 2, so callers can
  // require >= 3 to reject trivial matches like "Bern Germany" against
  // unrelated claims that happen to mention both cities.
  const d = similarityDetail('Sobral Brazil', 'other claim about Brazil generally');
  t.ok(d.intersection <= 2, 'sparse overlap: ' + d.intersection);
  t.end();
});
