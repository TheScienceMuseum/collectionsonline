const test = require('tape');
const getValues = require('../../lib/transforms/get-values');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

// ---------------------------------------------------------------------------
// getTitle() unit tests
//
// Tests display-name output for five representative records covering:
//   - Mimsy persons (cp50119 Steve Jobs)
//   - Mimsy organisations with structural commas (cp50168 Matsushita, cp96590 Worcester Railway)
//   - AdLib persons (ap8 Babbage)
//   - AdLib organisations (ap110 Great Western Railway)
// ---------------------------------------------------------------------------

// Helper to build a minimal item matching the shape getTitle() expects.
function makeItem (id, system, opts) {
  const source = system === 'Mimsy' ? 'Mimsy XG' : 'Adlib Archives';
  return {
    type: 'people',
    id,
    attributes: {
      summary: { title: opts.summaryTitle },
      name: opts.name || undefined,
      '@admin': { uid: id, source }
    }
  };
}

// --- cp50119: Mimsy person — "Steve Jobs" -----------------------------------

const cp50119 = makeItem('cp50119', 'Mimsy', {
  summaryTitle: 'Steve Jobs',
  name: [{ value: 'Jobs, Steve', type: 'preferred name', primary: true }]
});

test(file + 'cp50119 (Mimsy person) getTitle returns "Steve Jobs"', (t) => {
  t.plan(1);
  t.equal(
    getValues.getTitle(cp50119),
    'Steve Jobs',
    'Mimsy person should return summary.title in natural display order'
  );
});

// --- cp50168: Mimsy org — "Matsushita Electric Industrial Co., Ltd." --------

const cp50168 = makeItem('cp50168', 'Mimsy', {
  summaryTitle: 'Matsushita Electric Industrial Co., Ltd.',
  name: [{
    value: 'Matsushita Electric Industrial Co., Ltd.',
    type: 'preferred name',
    primary: true
  }]
});

test(file + 'cp50168 (Mimsy org with commas) getTitle returns full name intact', (t) => {
  t.plan(1);
  t.equal(
    getValues.getTitle(cp50168),
    'Matsushita Electric Industrial Co., Ltd.',
    'Mimsy org name with structural commas should be preserved'
  );
});

// --- cp96590: Mimsy org — "Oxford, Worcester & Wolverhampton Railway" ------

const cp96590 = makeItem('cp96590', 'Mimsy', {
  summaryTitle: 'Oxford, Worcester & Wolverhampton Railway',
  name: [{
    value: 'Oxford, Worcester & Wolverhampton Railway',
    type: 'preferred name',
    primary: true
  }]
});

test(file + 'cp96590 (Mimsy org with comma) getTitle returns full name intact', (t) => {
  t.plan(1);
  t.equal(
    getValues.getTitle(cp96590),
    'Oxford, Worcester & Wolverhampton Railway',
    'Mimsy org name with structural comma should be preserved'
  );
});

// --- ap8: AdLib person — "Babbage, Charles" → "Charles Babbage" -------------

const ap8 = makeItem('ap8', 'AdLib', {
  summaryTitle: 'Babbage, Charles',
  name: [{
    value: 'Babbage, Charles',
    type: 'full name',
    first: ['Charles'],
    last: 'Babbage'
  }]
});

test(file + 'ap8 (AdLib person) getTitle returns "Charles Babbage"', (t) => {
  t.plan(1);
  t.equal(
    getValues.getTitle(ap8),
    'Charles Babbage',
    'AdLib person should be reconstructed as "first last" from name fields'
  );
});

// --- ap110: AdLib org — "Great Western Railway Co" --------------------------

const ap110 = makeItem('ap110', 'AdLib', {
  summaryTitle: 'Great Western Railway Co',
  name: [{
    value: 'Great Western Railway Co',
    type: 'full name',
    last: 'Great Western Railway Co'
    // no name.first → organisation
  }]
});

test(file + 'ap110 (AdLib org) getTitle returns "Great Western Railway Co"', (t) => {
  t.plan(1);
  t.equal(
    getValues.getTitle(ap110),
    'Great Western Railway Co',
    'AdLib org (no name.first) should return summary.title as-is'
  );
});

// --- Edge cases -------------------------------------------------------------

test(file + 'AdLib person with first-name only (no last) returns first name', (t) => {
  // e.g. Queen Victoria (ap24384)
  t.plan(1);
  const item = makeItem('ap24384', 'AdLib', {
    summaryTitle: 'Victoria',
    name: [{
      value: 'Victoria',
      type: 'full name',
      first: ['Victoria']
      // no last field
    }]
  });
  t.equal(
    getValues.getTitle(item),
    'Victoria',
    'AdLib person with no surname should return first name only'
  );
});

test(file + 'Mimsy person with no summary.title falls back to name.value', (t) => {
  t.plan(1);
  const item = {
    type: 'people',
    id: 'cp99999',
    attributes: {
      name: [{ value: 'Doe, Jane', type: 'preferred name', primary: true }],
      '@admin': { uid: 'cp99999', source: 'Mimsy XG' }
    }
  };
  t.equal(
    getValues.getTitle(item),
    'Doe, Jane',
    'Mimsy person with no summary.title should fall back to name[0].value'
  );
});

test(file + 'non-people type returns primary title value', (t) => {
  t.plan(1);
  const item = {
    type: 'objects',
    id: 'co12345',
    attributes: {
      title: [{ value: 'Steam Engine', primary: true }],
      summary: { title: 'Steam Engine' }
    }
  };
  t.equal(
    getValues.getTitle(item),
    'Steam Engine',
    'Non-people type should return primary title value'
  );
});
