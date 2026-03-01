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
  t.plan(7);

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
    'immges/has_images gives same result'
  );
  t.end();
});

test('multiple param names', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'places/London+France' }),
    { params: { type: 'all' }, categories: { places: ['London', 'France'] } },
    'images/has_images gives same result'
  );
  t.end();
});

test('values with triple-dash (encoded space-dash-space)', function (t) {
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/box---container' }),
    { params: { type: 'objects' }, categories: { object_type: 'box---container' } },
    'triple-dash value is stored as raw URL string (decoded by dashToSpace in create-filters)'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/toy---recreational-artefact' }),
    { params: { type: 'objects' }, categories: { object_type: 'toy---recreational-artefact' } },
    'triple-dash with additional dashes stored as raw URL string'
  );
  t.deepEqual(
    parseParameters({ filters: 'objects/object_type/box---container+film-poster' }),
    { params: { type: 'objects' }, categories: { object_type: ['box---container', 'film-poster'] } },
    'multi-value with triple-dash splits correctly by +'
  );
  t.end();
});
