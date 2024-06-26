const test = require('tape');
const getTitlePage = require('../lib/helpers/search-results-to-template-data/title-page.js');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

// no filters selected
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {};
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'Search our collection | Science Museum Group Collection',
    'no filters - title ok'
  );
  t.end();
});

// filter other than category museum and gallery
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = { hasImage: { true: true } };
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'Search our collection | Science Museum Group Collection',
    'filter image selected - title ok'
  );
  t.end();
});

// filter containing the category museum or gallery but with other filter
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {
    hasImage: { true: true },
    gallery: { 'Science & Art of Medicine Gallery': true },
    museum: { 'Science Museum': true }
  };
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'Search our collection | Science Museum Group Collection',
    'filter museum but with image selected - title ok'
  );
  t.end();
});
// filter with category only
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {
    '': {
      Search: true
    },
    categories: {
      Photographs: true
    },
    type: {
      all: true
    }
  };
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'Photographs | Science Museum Group Collection',
    'filter category - title ok'
  );
  t.end();
});
// filter with category only bit with a query parameter q
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {
    '': {
      Search: true
    },
    categories: {
      Photographs: true
    },
    type: {
      all: true
    }
  };
  const title = getTitlePage('babbage', selectedFilters);
  t.equal(
    title,
    'Search our collection | Science Museum Group Collection',
    'filter category - title ok'
  );
  t.end();
});
// filter with museum and gallery
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {
    gallery: { Warehouse: true },
    museum: { 'National Railway Museum': true }
  };
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'On display at the National Railway Museum | Warehouse | Science Museum Group Collection',
    'filter museum & gallery - title ok'
  );
  t.end();
});

// filter with category and museum and gallery (a gallery can't be defined without a museum)
test(file + 'serp title - no filters selected', (t) => {
  const selectedFilters = {
    categories: { 'Railway Posters, Notices & Handbills': true },
    gallery: { Warehouse: true },
    museum: { 'National Railway Museum': true }
  };
  const title = getTitlePage('', selectedFilters);
  t.equal(
    title,
    'Railway Posters, Notices & Handbills on display at the National Railway Museum | Warehouse | Science Museum Group Collection',
    'filter museum & gallery - title ok'
  );
  t.end();
});
