'use strict';

const test = require('tape');
const truncateDescription = require('../lib/ai/truncate-description');

test('truncate-description: empty / non-string input returns empty string', function (t) {
  t.equal(truncateDescription('', 100), '');
  t.equal(truncateDescription(null, 100), '');
  t.equal(truncateDescription(undefined, 100), '');
  t.equal(truncateDescription(123, 100), '');
  t.equal(truncateDescription({}, 100), '');
  t.end();
});

test('truncate-description: invalid maxChars returns trimmed text unchanged', function (t) {
  t.equal(truncateDescription('  hello  ', 0), 'hello');
  t.equal(truncateDescription('  hello  ', -1), 'hello');
  t.equal(truncateDescription('  hello  ', null), 'hello');
  t.equal(truncateDescription('  hello  ', 'abc'), 'hello');
  t.end();
});

test('truncate-description: short text returns trimmed unchanged', function (t) {
  t.equal(truncateDescription('Hello.', 100), 'Hello.');
  t.equal(truncateDescription('  Hello.  ', 100), 'Hello.', 'trims surrounding whitespace');
  t.end();
});

test('truncate-description: text equal to cap returns as-is', function (t) {
  const text = 'Exactly thirty chars long here'; // 30 chars
  t.equal(text.length, 30);
  t.equal(truncateDescription(text, 30), text);
  t.end();
});

test('truncate-description: prefers last sentence boundary inside cap', function (t) {
  const text = 'First sentence. Second sentence. Third sentence here continues on and on past the cap.';
  // Cap = 35: slice = "First sentence. Second sentence. T"
  // Last sentence end = position after "Second sentence." = 32
  const out = truncateDescription(text, 35);
  t.equal(out, 'First sentence. Second sentence.');
  t.end();
});

test('truncate-description: handles question and exclamation marks', function (t) {
  t.equal(
    truncateDescription('Was it real? The answer is yes. There was more text afterwards too.', 30),
    'Was it real?',
    'question mark counts as sentence end'
  );
  t.equal(
    truncateDescription('Eureka! He shouted loudly. There was more text afterwards too.', 30),
    'Eureka! He shouted loudly.',
    'exclamation mark counts as sentence end'
  );
  t.end();
});

test('truncate-description: treats common abbreviations as non-terminal', function (t) {
  // "Dr." should not be treated as a sentence end
  const text1 = 'Dr. Smith was a notable physician of the 19th century. He worked at...';
  t.equal(truncateDescription(text1, 60), 'Dr. Smith was a notable physician of the 19th century.');

  // "U.S." likewise
  const text2 = 'The U.S. Army adopted the system. It was installed at many bases.';
  t.equal(truncateDescription(text2, 40), 'The U.S. Army adopted the system.');

  // "etc."
  const text3 = 'They produced cameras, lenses, etc. The factory closed in 1963.';
  t.equal(truncateDescription(text3, 50), 'They produced cameras, lenses, etc.');

  // "Ph.D."
  const text4 = 'She earned her Ph.D. at Cambridge. Her thesis was published.';
  t.equal(truncateDescription(text4, 40), 'She earned her Ph.D. at Cambridge.');

  // "Mr.", "Mrs.", "Ms.", "Jr.", "Sr.", "Ltd."
  t.equal(
    truncateDescription('Mr. Brown founded the company. Later he retired.', 40),
    'Mr. Brown founded the company.'
  );
  t.equal(
    truncateDescription('Smith Ltd. closed in 1972. Operations had run for decades.', 35),
    'Smith Ltd. closed in 1972.'
  );

  t.end();
});

test('truncate-description: does not split on decimal numbers', function (t) {
  const text = 'The instrument measured 1.5 metres in length. A second device was 2.7 metres long.';
  // Cap = 50: should find sentence end after "...length." (position 46)
  const out = truncateDescription(text, 50);
  t.equal(out, 'The instrument measured 1.5 metres in length.');
  t.end();
});

test('truncate-description: does not split inside ellipsis', function (t) {
  const text = 'He paused... Then continued speaking. The rest is history.';
  // Cap = 40: should NOT cut at any of the three dots in "..."
  const out = truncateDescription(text, 40);
  t.equal(out, 'He paused... Then continued speaking.');
  t.end();
});

test('truncate-description: falls back to word-boundary + ellipsis when no sentence end fits', function (t) {
  // No sentence terminator at all
  const text1 = 'A very long noun phrase with no terminator at all that goes on past the cap';
  const out1 = truncateDescription(text1, 30);
  t.ok(out1.endsWith('…'), 'fallback ends with ellipsis');
  t.ok(out1.length <= 30, 'fallback respects cap length');
  t.notOk(/\s$/.test(out1.replace('…', '')), 'fallback ends at word boundary');

  // Sentence end exists but well below the 30% threshold of the cap
  const text2 = 'OK. ' + 'a'.repeat(500); // first sentence ends at pos 3, well under 30% of cap=200
  const out2 = truncateDescription(text2, 200);
  t.ok(out2.endsWith('…'), 'too-early sentence end → fallback');
  t.end();
});

test('truncate-description: cp37054 / co56649 case at cap=200 returns the first sentence cleanly', function (t) {
  // The exact catalogue description that produced the Eddington / Sobral
  // hallucination. With sentence-boundary truncation, the first sentence
  // ends at "1919 May 29." (position 130) and Eddington is excluded —
  // the model then has nothing to bridge from.
  const text = 'Mounted photograph (passe partout) showing the instruments used at Sobral, Brazil, during the total solar eclipse of 1919 May 29.  The expedition organised by Sir Arthur Eddington of the Royal Greenwich Observatory used photographs taken during the eclipse to measure the deflection of star light adjacent to the Sun as predicted by Einstein in his Theory of Relativity.';
  const out = truncateDescription(text, 200);
  t.equal(
    out,
    'Mounted photograph (passe partout) showing the instruments used at Sobral, Brazil, during the total solar eclipse of 1919 May 29.'
  );
  t.notOk(out.toLowerCase().includes('eddington'), 'Eddington name no longer in truncated description');
  t.notOk(out.endsWith('…'), 'sentence-boundary cut is not signalled with ellipsis');
  t.end();
});

test('truncate-description: cp37054 / co56649 case at cap=500 returns full description', function (t) {
  const text = 'Mounted photograph (passe partout) showing the instruments used at Sobral, Brazil, during the total solar eclipse of 1919 May 29.  The expedition organised by Sir Arthur Eddington of the Royal Greenwich Observatory used photographs taken during the eclipse to measure the deflection of star light adjacent to the Sun as predicted by Einstein in his Theory of Relativity.';
  const out = truncateDescription(text, 500);
  t.equal(out, text.trim(), 'fits within 500-char cap → no truncation');
  t.end();
});

test('truncate-description: trailing whitespace / final period both handled', function (t) {
  const text = 'Sentence one. Sentence two.   ';
  t.equal(truncateDescription(text, 100), 'Sentence one. Sentence two.', 'trims trailing whitespace');
  t.end();
});

test('truncate-description: sentence terminator at exact end of cap is preserved', function (t) {
  // 'Hello world.' length = 12
  t.equal(truncateDescription('Hello world. Goodbye.', 12), 'Hello world.');
  t.end();
});

test('truncate-description: handles initials in person names ("A. B. Smith")', function (t) {
  const text = 'A. B. Smith was a known photographer. His studio was in Paris.';
  // Cap = 50: should find the period after "photographer." not after the initials
  const out = truncateDescription(text, 50);
  t.equal(out, 'A. B. Smith was a known photographer.');
  t.end();
});
