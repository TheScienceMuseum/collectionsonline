const test = require('tape');
const createDescriptionBox = require('../lib/create-description-box.js');

test("createDescriptionBox - with category that doesn't have description yet", (t) => {
  const query = {
    q: { book: true },
    'page[size]': { 50: true },
    type: { all: true },
    categories: { 'Non existent category': true }
  };
  const actual = createDescriptionBox(query);
  const expected = undefined;

  t.equal(actual, expected);
  t.end();
});

test('createDescriptionBox - category', (t) => {
  const query = {
    q: { phone: true },
    'page[size]': { 50: true },
    type: { all: true },
    categories: { Telecommunications: true }
  };
  const actual = Object.keys(createDescriptionBox(query).category);
  const expected = [
    'title',
    'description',
    'sub-categories',
    'related-articles'
  ];

  t.deepEqual(actual, expected);
  t.end();
});

test("createDescriptionBox - with gallery which doesn't have description yet", (t) => {
  const query = {
    q: { book: true },
    'page[size]': { 50: true },
    type: { all: true },
    gallery: { 'Non existent gallery': true }
  };
  const actual = createDescriptionBox(query);
  const expected = undefined;

  t.equal(actual, expected);
  t.end();
});

test('createDescriptionBox - gallery', (t) => {
  const query = {
    q: { book: true },
    'page[size]': { 50: true },
    type: { all: true },
    gallery: { 'Great Hall': true },
    museum: { 'National Railway Museum': true }
  };
  const actual = Object.keys(createDescriptionBox(query).gallery);
  const expected = ['description', 'link-to-gallery-page', 'title'];

  t.deepEqual(actual, expected);
  t.end();
});

test('createDescriptionBox - museum', (t) => {
  const query = {
    q: { phone: true },
    'page[size]': { 50: true },
    type: { all: true },
    museum: { 'Science Museum': true }
  };
  const actual = Object.keys(createDescriptionBox(query).museum);
  const expected = ['title', 'thumbnail', 'description', 'link'];

  t.deepEqual(actual, expected);
  t.end();
});

const mphcParent = {
  _source: {
    description:
      'Collection of objects and archives from Boddingtons Brewery at Strangeways, Manchester, c1883-2003.',
    title:
      'Collection of objects and archives from Boddingtons Brewery at Strangeways',
    link: 'collection.sciencemuseumgroup.org.uk/objects/co8413731/collection-of-objects-and-archives-from-boddingtons-brewery-at-strangeways'
  }
};

const invalidMphcParent = undefined;

test('createDescriptionBox - mphc valid', (t) => {
  const selectedFilters = {
    type: { objects: true },
    mphc: { co8413731: true }
  };
  const rootUrl =
    'collection.sciencemuseumgroup.org.uk/objects/co8413731/collection-of-objects-and-archives-from-boddingtons-brewery-at-strangeways';

  const actual = createDescriptionBox(selectedFilters, mphcParent, rootUrl);

  const expected = ['description', 'title', 'link'];

  t.deepEqual(Object.keys(actual.mphc), expected);
  t.end();
});

test('createDescriptionBox - mphc valid', (t) => {
  const selectedFilters = {
    type: { objects: true },
    mphc: { co841373e: true }
  };
  const rootUrl =
    'collection.sciencemuseumgroup.org.uk/search/objects/mphc/co841373e';

  const actual = createDescriptionBox(
    selectedFilters,
    invalidMphcParent,
    rootUrl
  );

  const expected = undefined;

  t.deepEqual(actual, expected);
  t.end();
});
