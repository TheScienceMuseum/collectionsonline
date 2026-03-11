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
    '/collection/buckingham-movie-museum%252fjohn-burgoyne%252djohnson-collection',
    'forward slash and hyphen both double-encoded in array value'
  );
  t.equal(
    paramify({ collection: 'buckingham movie museum/john burgoyne-johnson collection' }),
    '/collection/buckingham-movie-museum%252fjohn-burgoyne%252djohnson-collection',
    'forward slash and hyphen both double-encoded in string value'
  );
  t.end();
});

test(file + 'paramify double-encodes hyphens in values as %252D', (t) => {
  t.equal(
    paramify({ makers: ['Rolls-Royce'] }),
    '/makers/rolls%252droyce',
    'hyphen in array value encoded as %252D (lowercased)'
  );
  t.equal(
    paramify({ makers: 'Rolls-Royce' }),
    '/makers/rolls%252droyce',
    'hyphen in string value encoded as %252D (lowercased)'
  );
  t.equal(
    paramify({ collection: ['Tony Ray-Jones Collection'] }),
    '/collection/tony-ray%252djones-collection',
    'hyphen in collection name encoded correctly'
  );
  t.end();
});

test(file + 'paramify double-encodes commas in values as %252C', (t) => {
  t.equal(
    paramify({ places: ['Science Museum, London'] }),
    '/places/science-museum%252c-london',
    'comma in array value encoded as %252C'
  );
  t.equal(
    paramify({ places: 'Science Museum, London' }),
    '/places/science-museum%252c-london',
    'comma in string value encoded as %252C'
  );
  t.equal(
    paramify({ makers: ['Science Museum, London', 'Rolls-Royce'] }),
    '/makers/science-museum%252c-london+rolls%252droyce',
    'multiple values: comma and hyphen both encoded'
  );
  t.end();
});

test(file + 'paramify encodes values with space-dash-space correctly', (t) => {
  t.equal(
    paramify({ object_type: ['box - container'] }),
    '/object_type/box-%252d-container',
    'space-dash-space: the dash is encoded as %252D, spaces become dashes'
  );
  t.equal(
    paramify({ object_type: ['toy - recreational artefact'] }),
    '/object_type/toy-%252d-recreational-artefact',
    'space-dash-space plus normal spaces encoded correctly'
  );
  t.equal(
    paramify({ object_type: ['film poster'] }),
    '/object_type/film-poster',
    'normal space becomes single dash'
  );
  t.end();
});
