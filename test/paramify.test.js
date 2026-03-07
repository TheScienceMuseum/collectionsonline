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

test(file + 'paramify double-encodes forward slashes in values as %252f', (t) => {
  t.equal(
    paramify({ collection: ['buckingham movie museum/john burgoyne-johnson collection'] }),
    '/collection/buckingham-movie-museum%252fjohn-burgoyne-johnson-collection',
    'forward slash in array value double-encoded as %252f (survives Hapi %25 decode)'
  );
  t.equal(
    paramify({ collection: 'buckingham movie museum/john burgoyne-johnson collection' }),
    '/collection/buckingham movie museum%252fjohn burgoyne-johnson collection',
    'forward slash in single string value double-encoded as %252f'
  );
  t.end();
});

test(file + 'paramify converts escaped commas (\\,) to %2C in URL so server does not double-escape', (t) => {
  // Simulates values that came through parse-params.js comma-escaping on the client side.
  // paramify must unescape \, → %2C so the server's parse-params only escapes once.
  t.equal(
    paramify({ places: 'Paddington\\, London' }),
    '/places/paddington%2c london',
    'string: escaped comma becomes %2C in URL (space kept as-is for string branch)'
  );
  t.equal(
    paramify({ makers: ['Science Museum\\, London', 'Rolls Royce'] }),
    '/makers/science-museum%2c-london+rolls-royce',
    'array: escaped comma becomes %2C and spaces become dashes'
  );
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
