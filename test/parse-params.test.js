const test = require('tape');
const parseParameters = require('../routes/route-helpers/parse-params');

test('parsing url params', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects' }),
    { params: { type: 'objects' }, categories: {} },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'people' }),
    { params: { type: 'people' }, categories: {} },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'documents' }),
    { params: { type: 'documents' }, categories: {} },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'group' }),
    { params: { type: 'group' }, categories: {} },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/images' }),
    { params: { type: 'objects' }, categories: { has_image: 'has_image' } },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/image_license' }),
    {
      params: { type: 'objects' },
      categories: { image_license: 'Image_license' }
    },
    'parses type correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/art/images' }),
    {
      params: { type: 'objects' },
      categories: { has_image: 'has_image', categories: 'Art' }
    },
    'parses type correctly'
  );
  t.end();
});

test('parsing lowercase url params', function (t) {
  t.plan(2);

  t.deepEqual(
    parseParameters({ filters: 'objects/categories/art' }),
    { params: { type: 'objects' }, categories: { categories: 'Art' } },
    'non-capitalised categories should work'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/art' }),
    parseParameters({ filters: 'objects/categories/Art' }),
    'non-capitalised categories should be the same as capitalised'
  );
  t.end();
});

test('parsing museum params', function (t) {
  t.plan(8);

  t.deepEqual(
    parseParameters({ filters: 'objects/museum/scm' }),
    { params: { type: 'objects' }, categories: { museum: 'Science Museum' } },
    'should convert short museum name'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/museum/sim' }),
    {
      params: { type: 'objects' },
      categories: { museum: 'Science and Industry Museum' }
    },
    'should convert short museum name'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/museum/nrm' }),
    {
      params: { type: 'objects' },
      categories: { museum: 'National Railway Museum' }
    },
    'should convert short museum name'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/museum/nsmm' }),
    {
      params: { type: 'objects' },
      categories: { museum: 'National Science and Media Museum' }
    },
    'should convert short museum name'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/museum/Science-Museum' }),
    { params: { type: 'objects' }, categories: { museum: 'Science Museum' } },
    'should keep long museum name'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/museum/National-Railway-Museum' }),
    {
      params: { type: 'objects' },
      categories: { museum: 'National Railway Museum' }
    },
    'should keep long museum name'
  );
  t.deepEqual(
    parseParameters({
      filters: 'objects/museum/science-and-industry-museum'
    }),
    {
      params: { type: 'objects' },
      categories: { museum: 'Science and Industry Museum' }
    },
    'should convert museum name to correct case'
  );
  t.doesNotThrow(
    function () { parseParameters({ filters: 'objects/museum' }); },
    'should not throw when museum value is missing'
  );
  t.end();
});

test('param order', function (t) {
  t.plan(2);

  t.deepEqual(
    parseParameters({ filters: 'objects/images/museum/scm/categories/art' }),
    {
      params: { type: 'objects' },
      categories: {
        museum: 'Science Museum',
        categories: 'Art',
        has_image: 'has_image'
      }
    },
    'param order does not matter'
  );
  t.deepEqual(
    parseParameters({
      filters:
        'objects/museum/scm/images/gallery/mathematics:-the-winton-gallery/categories/art'
    }),
    {
      params: { type: 'objects' },
      categories: {
        museum: 'Science Museum',
        gallery: 'Mathematics: The Winton Gallery',
        categories: 'Art',
        has_image: 'has_image'
      }
    },
    'param order does not matter'
  );
  t.end();
});

test('alternative param names', function (t) {
  t.plan(2);

  t.deepEqual(
    parseParameters({ filters: 'categories/art' }),
    parseParameters({ filters: 'category/art' }),
    'category/categories gives same result'
  );
  t.deepEqual(
    parseParameters({ filters: 'images' }),
    parseParameters({ filters: 'has_image' }),
    'images/has_image gives same result'
  );
  t.end();
});

test('multiple param names', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'places/London+France' }),
    { params: { type: 'all' }, categories: { places: ['London', 'France'] } },
    'multiple values split by + correctly'
  );
  t.end();
});

test('excluded filter values (object_type, material, occupation) are decoded but not title-cased', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/film-poster' }),
    { params: { type: 'objects' }, categories: { object_type: 'film poster' } },
    'single-dash decodes to space (no title-case for excluded filter)'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/black%2dand%2dwhite-print' }),
    { params: { type: 'objects' }, categories: { object_type: 'black-and-white print' } },
    '%2D in excluded filter decodes to hyphen via decodeURIComponent'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/black%2dand%2dwhite-print+film-poster' }),
    { params: { type: 'objects' }, categories: { object_type: ['black-and-white print', 'film poster'] } },
    'multi-value excluded filter decoded correctly'
  );
  t.end();
});

test('triple-dash (legacy space-dash-space encoding) still works for both excluded and non-excluded', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/box---container' }),
    { params: { type: 'objects' }, categories: { object_type: 'box - container' } },
    'triple-dash in excluded filter decoded to space-dash-space'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/science---technology' }),
    { params: { type: 'objects' }, categories: { categories: 'Science - Technology' } },
    'triple-dash in category decodes to title-cased space-dash-space'
  );
  t.end();
});

test('filter values with %2f are decoded back to forward slash with per-segment capitalisation', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'collection/buckingham-movie-museum%2fjohn-burgoyne-johnson-collection' }),
    { params: { type: 'all' }, categories: { collection: 'Buckingham Movie Museum/John Burgoyne Johnson Collection' } },
    '%2f in collection value decoded to / before title-casing (each segment capitalised separately)'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/camera-accessory%2fplate' }),
    { params: { type: 'objects' }, categories: { object_type: 'camera accessory/plate' } },
    '%2f in excluded filter type value decoded to / (no title-casing, dashes to spaces)'
  );
  t.end();
});

test('new %2D encoding: hyphens in filter values survive the round-trip', function (t) {
  // Hapi decodes %25 → %, so the app sees %2D after Hapi processing; then decodeURIComponent converts %2D → -
  t.deepEqual(
    parseParameters({ filters: 'collection/tony-ray%2djones-collection' }),
    { params: { type: 'all' }, categories: { collection: 'Tony Ray-Jones Collection' } },
    'hyphen in collection name decoded correctly and title-cased'
  );
  t.deepEqual(
    parseParameters({ filters: 'collection/buckingham-movie-museum%2fjohn-burgoyne%2djohnson-collection' }),
    { params: { type: 'all' }, categories: { collection: 'Buckingham Movie Museum/John Burgoyne-Johnson Collection' } },
    'slash + hyphen in collection decoded correctly with proper word-boundary capitalisation'
  );
  t.deepEqual(
    parseParameters({ filters: 'makers/rolls%2droyce' }),
    { params: { type: 'all' }, categories: { makers: 'Rolls-Royce' } },
    'hyphenated maker name decoded correctly'
  );
  t.end();
});

test('filter values with commas decoded correctly (no backslash escaping)', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects/makers/science-museum,-london' }),
    { params: { type: 'objects' }, categories: { makers: 'Science Museum, London' } },
    'comma in maker name decoded to literal comma (no backslash escape)'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/makers/science-museum%2c-london' }),
    { params: { type: 'objects' }, categories: { makers: 'Science Museum, London' } },
    'old %2C comma URL decoded correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/makers/science-museum,-london+rolls%2droyce' }),
    { params: { type: 'objects' }, categories: { makers: ['Science Museum, London', 'Rolls-Royce'] } },
    'multiple makers: comma-containing name decoded, hyphenated name decoded'
  );
  t.end();
});

test('SPA client path: excluded filter values with raw %252D decode via two decodeURIComponent passes', function (t) {
  // On the SPA (page.js) route the browser does not pre-decode the URL, so the raw
  // %252D reaches parseParams and must be decoded twice to become a literal hyphen.
  // This test mirrors a user clicking an occupation filter link without a full page load.
  t.deepEqual(
    parseParameters({ filters: 'people/occupation/make%252dup-artist' }),
    { params: { type: 'people' }, categories: { occupation: 'make-up artist' } },
    'occupation with %252D decodes correctly on the SPA path'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/black%252dand%252dwhite-print' }),
    { params: { type: 'objects' }, categories: { object_type: 'black-and-white print' } },
    'object_type with multiple %252D decodes correctly on the SPA path'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/material/stainless%252dsteel+brushed-aluminium' }),
    { params: { type: 'objects' }, categories: { material: ['stainless-steel', 'brushed aluminium'] } },
    'multi-value material filter with %252D decoded correctly on the SPA path'
  );
  t.end();
});

test('categories with single-dash still title-cased correctly', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/art' }),
    { params: { type: 'objects' }, categories: { categories: 'Art' } },
    'plain category still title-cased correctly'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/x-rays' }),
    { params: { type: 'objects' }, categories: { categories: 'X Rays' } },
    'x-rays single dash still becomes title-cased word pair'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/categories/penn-gaskell-collection' }),
    { params: { type: 'objects' }, categories: { categories: 'Penn Gaskell Collection' } },
    'multi-word category with single dashes still title-cased correctly'
  );
  t.end();
});
