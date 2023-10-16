const test = require('tape');
const truncate = require('../../templates/helpers/truncate');

test('Truncate should return the value if empty', (t) => {
  const val = 'Set of nine wax plaques showing foetal development and dissection views of a female figure, Europe, 1801-1830';
  t.equal(truncate('', { type: 'object' }), '', 'truncate return empty string');
  t.equal(truncate(val, { type: 'object' }), 'Set of nine wax plaques showing foetal dev...', 'truncate the value');
  t.end();
});
