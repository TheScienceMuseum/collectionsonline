const test = require('tape');
const toggleDetail = require('../templates/helpers/toggleDetail.js');

test('Return true/false depending on key on which toggle is applied', (t) => {
  const options = { data: { root: { page: '' } } };
  t.equal(toggleDetail('SYSTEM OF ARRANGEMENT', options), true, 'toggle for system of arrangement key');
  t.equal(toggleDetail('IDENTIFIER', options), false, 'no toggle for identifer');
  t.end();
});
