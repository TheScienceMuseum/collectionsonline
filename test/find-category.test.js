const test = require('tape');
const findCategory = require('../client/lib/find-category.js');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'findCategory finds type when it is the segment immediately after /search/', (t) => {
  t.equal(findCategory('/search/people'), 'people', 'matches /search/people');
  t.equal(findCategory('/search/objects'), 'objects', 'matches /search/objects');
  t.equal(findCategory('/search/documents'), 'documents', 'matches /search/documents');
  t.equal(findCategory('/search/group'), 'group', 'matches /search/group');
  t.equal(findCategory('/search/people/collection/some-filter'), 'people', 'matches /search/people with extra segments');
  t.equal(findCategory('/search/objects/makers/rolls-royce'), 'objects', 'matches /search/objects with filter');
  t.end();
});

test(file + 'findCategory does not match type word in filter key or value positions', (t) => {
  t.equal(findCategory('/search/collection/people,-pride-and-progress'), undefined,
    'does not match "people" inside collection name slug');
  t.equal(findCategory('/search/collection/objects-of-science'), undefined,
    'does not match "objects" inside collection slug');
  t.equal(findCategory('/search/categories/documents-and-archives'), undefined,
    'does not match "documents" inside category slug');
  t.equal(findCategory('/search/collection/people'), undefined,
    'does not match "people" when it is a filter value (not type position)');
  t.equal(findCategory('/search/makers/objects'), undefined,
    'does not match "objects" when it is a filter value');
  t.equal(findCategory('/search/collection/group-of-objects'), undefined,
    'does not match "group" at start of a filter value slug');
  t.equal(findCategory('/search/makers/group'), undefined,
    'does not match "group" when it is a filter value');
  t.equal(findCategory('/search'), undefined, 'returns undefined for bare /search');
  t.end();
});
