var test = require('tape');
var createDescriptionBox = require('../lib/create-description-box.js');

test('createDescriptionBox - with category that doesn\'t have description yet', (t) => {
  const query = {
    q: {book: true},
    'page[size]': {'50': true},
    type: {all: true},
    categories: {'Non existent category': true}
  };
  const actual = createDescriptionBox(query);
  const expected = undefined;

  t.equal(actual, expected);
  t.end();
});

test('createDescriptionBox - category', (t) => {
  const query = {
    q: { phone: true },
    'page[size]': {'50': true},
    type: {all: true},
    categories: {Telecommunications: true}
  };
  const actual = Object.keys(createDescriptionBox(query).category);
  const expected = ['title', 'description', 'sub-categories', 'related-articles'];

  t.deepEqual(actual, expected);
  t.end();
});

test('createDescriptionBox - with gallery which doesn\'t have description yet', (t) => {
  const query = {
    q: {book: true},
    'page[size]': {'50': true},
    type: {all: true},
    gallery: {'Non existent gallery': true}
  };
  const actual = createDescriptionBox(query);
  const expected = undefined;

  t.equal(actual, expected);
  t.end();
});

test('createDescriptionBox - gallery', (t) => {
  const query = {
    q: {book: true},
    'page[size]': {'50': true},
    type: {all: true},
    gallery: {'Great Hall': true},
    museum: {'National Railway Museum': true}
  };
  const actual = Object.keys(createDescriptionBox(query).gallery);
  const expected = ['description', 'title', 'link-to-gallery-page'];

  t.deepEqual(actual, expected);
  t.end();
});

test('createDescriptionBox - museum', (t) => {
  const query = {
    q: {phone: true},
    'page[size]': {'50': true},
    type: {all: true},
    museum: {'Science Museum': true}
  };
  const actual = Object.keys(createDescriptionBox(query).museum);
  const expected = ['title', 'thumbnail', 'description', 'link'];

  t.deepEqual(actual, expected);
  t.end();
});
