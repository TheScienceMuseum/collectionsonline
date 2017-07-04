var test = require('tape');
var createDescriptionBox = require('../lib/create-description-box.js');

/*{ q: { book: true },
  'page[size]': { '50': true },
    type: { all: true },
      categories: { 'Printed Books': true } }*/

/* { q: { phone: true },
 *   'page[size]': { '50': true },
 *     type: { all: true },
 *       categories: { Telecommunications: true } }*/

test('createDescriptionBox', (t) => {
  t.equal(true, true);
  t.end();
});
