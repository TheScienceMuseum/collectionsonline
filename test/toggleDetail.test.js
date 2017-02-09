const test = require('tape');
const toggleDetail = require('../templates/helpers/toggleDetail.js');
// ['SYSTEM OF ARRANGEMENT', 'COPYRIGHT', 'HISTORY NOTE'];
test('Return true/false depending on key on which toggle is applied', (t) => {
  console.log(toggleDetail('SYSTEM OF ARRANGEMENT'));
  t.equal(toggleDetail('SYSTEM OF ARRANGEMENT'), true, 'toggle for system of arrangement key');
  t.equal(toggleDetail('IDENTIFIER'), false, 'no toggle for identifer');
  t.end();
});
