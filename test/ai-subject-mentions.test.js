'use strict';

const test = require('tape');
const sentencesNaming = require('../lib/ai/subject-mentions');
const { nameVariants, splitSentences } = sentencesNaming;

const DOLLY_WEB = 'This jumper was made from the first fleece of ‘Dolly’ the sheep, the first mammal to be cloned from an adult cell. ' +
  'Dolly was cloned at the Roslin Institute in Edinburgh, Scotland.\n\n' +
  'In September 1997, a competition called \'Do a Design for Dolly\' by the Cystic Fibrosis Trust and supported by Portman Building Society. ' +
  'BBC programme The Clothes Show launched the competition.';

test('nameVariants: organisations get the full name only', (t) => {
  t.deepEqual(nameVariants('Portman Building Society'), ['Portman Building Society']);
  t.deepEqual(nameVariants('Great Western Railway'), ['Great Western Railway']);
  t.deepEqual(nameVariants('Hamer, Metcalfe and Davies'), ['Hamer, Metcalfe and Davies']);
  t.end();
});

test('nameVariants: people also get the surname', (t) => {
  t.deepEqual(nameVariants('Thomas Sutcliffe'), ['Thomas Sutcliffe', 'Sutcliffe']);
  t.deepEqual(nameVariants('Charles F Topham'), ['Charles F Topham', 'Topham']);
  t.deepEqual(nameVariants('Huxley, Andrew Fielding'), ['Huxley, Andrew Fielding', 'Andrew Fielding Huxley', 'Huxley']);
  t.deepEqual(nameVariants('Henry Yule (1820-1889)'), ['Henry Yule', 'Yule'], 'brackets dropped');
  t.deepEqual(nameVariants('Ann Lee'), ['Ann Lee'], 'surname under four letters: full name only');
  t.deepEqual(nameVariants('Barbara'), ['Barbara'], 'single name: full name only');
  t.deepEqual(nameVariants(''), []);
  t.deepEqual(nameVariants(undefined), []);
  t.end();
});

test('splitSentences splits on sentence ends and paragraphs, not abbreviations', (t) => {
  t.deepEqual(splitSentences('Made by Dr. Smith in London. Given in 1920.\n\nSecond para'),
    ['Made by Dr. Smith in London.', 'Given in 1920.', 'Second para']);
  t.end();
});

test('Dolly jumper: the web-description sentence naming Portman is returned', (t) => {
  const out = sentencesNaming([DOLLY_WEB], 'Portman Building Society', ['Jumper knitted from the first fleece of Dolly.']);
  t.deepEqual(out, ['In September 1997, a competition called \'Do a Design for Dolly\' by the Cystic Fibrosis Trust and supported by Portman Building Society.']);
  t.end();
});

test('surname match for a person; whole words only', (t) => {
  const web = 'The frame was rebuilt by Sutcliffe, great-grandson of Kay. Sutcliffes of Halifax made looms.';
  t.deepEqual(sentencesNaming([web], 'Thomas Sutcliffe', []),
    ['The frame was rebuilt by Sutcliffe, great-grandson of Kay.'], '"Sutcliffes" is not "Sutcliffe"');
  t.end();
});

test('sentences already in the primary description or title are skipped', (t) => {
  const primary = 'Model made by Hargrave. Brass and wood.';
  t.deepEqual(sentencesNaming(['Model made by Hargrave. Hargrave flew kites.'], 'Lawrence Hargrave', [primary]),
    ['Hargrave flew kites.']);
  t.end();
});

test('nothing without a name or texts', (t) => {
  t.deepEqual(sentencesNaming([], 'Portman Building Society', []), []);
  t.deepEqual(sentencesNaming([DOLLY_WEB], undefined, []), []);
  t.deepEqual(sentencesNaming(undefined, 'X Y', []), []);
  t.end();
});

test('caps: at most two sentences, long sentences cut', (t) => {
  const many = 'Smithson built it. Smithson sold it. Smithson gave it away.';
  t.equal(sentencesNaming([many], 'James Smithson', []).length, sentencesNaming.MAX_SENTENCES);
  const long = 'Smithson ' + 'word '.repeat(120) + 'end.';
  const out = sentencesNaming([long], 'James Smithson', []);
  t.equal(out.length, 1);
  t.ok(out[0].length <= 301, 'cut to about 300 chars');
  t.end();
});

test('an initial is not a sentence end', (t) => {
  t.deepEqual(splitSentences('Bust by Sir F. Chantrey, RA, and now in Oxford. Cast later.'),
    ['Bust by Sir F. Chantrey, RA, and now in Oxford.', 'Cast later.']);
  t.end();
});
