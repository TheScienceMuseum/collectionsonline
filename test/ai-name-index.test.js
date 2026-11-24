'use strict';

// lib/ai/name-index.js: admin name search over the stats name index.

const test = require('tape');
const nameIndex = require('../lib/ai/name-index');

test('name-index: finds a record anywhere in the index, case-insensitively', function (t) {
  const index = [];
  for (let i = 0; i < 200; i++) index.push({ pk: 'cp' + i, name: 'Person ' + i });
  index.push({ pk: 'cp999', name: 'Royal Raymond Rife' }); // oldest
  t.deepEqual(nameIndex.match(index, 'RIFE'), [{ pk: 'cp999', name: 'Royal Raymond Rife' }]);
  t.deepEqual(nameIndex.match(index, '  raymond rif '), [{ pk: 'cp999', name: 'Royal Raymond Rife' }], 'trimmed, substring');
  t.end();
});

test('name-index: keeps index order (newest first) and returns every match', function (t) {
  const index = [
    { pk: 'cp4', name: 'Smith D' },
    { pk: 'cp3', name: 'Jones' },
    { pk: 'cp2', name: 'Smith B' },
    { pk: 'cp1', name: 'smith a' }
  ];
  t.deepEqual(nameIndex.match(index, 'smith').map(function (e) { return e.pk; }), ['cp4', 'cp2', 'cp1']);
  t.end();
});

test('name-index: blank query, no index or nameless entries match nothing', function (t) {
  const index = [{ pk: 'cp1', name: '' }, { pk: 'cp2' }];
  t.deepEqual(nameIndex.match(index, '   '), [], 'blank query');
  t.deepEqual(nameIndex.match(undefined, 'ada'), [], 'no index yet');
  t.deepEqual(nameIndex.match(index, 'a'), [], 'entries without a name');
  t.end();
});
