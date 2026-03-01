const test = require('tape');
const paramify = require('../lib/helpers/paramify.js');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'paramify transforms query', (t) => {
  const query = {
    has_image: true,
    categories: 'Art'
  };

  t.equal(paramify(query), '/images/categories/art', 'Query becomes param string');
  t.end();
});

test(file + 'paramify encodes values with space-dash-space correctly', (t) => {
  t.equal(
    paramify({ object_type: ['box - container'] }),
    '/object_type/box---container',
    'space-dash-space in value becomes triple dash in URL'
  );
  t.equal(
    paramify({ object_type: ['toy - recreational artefact'] }),
    '/object_type/toy---recreational-artefact',
    'space-dash-space plus normal spaces encoded correctly'
  );
  t.equal(
    paramify({ object_type: ['film poster'] }),
    '/object_type/film-poster',
    'normal space becomes single dash'
  );
  t.end();
});
