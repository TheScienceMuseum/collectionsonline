const test = require('tape');
const getPrimaryValue = require('../../templates/helpers/get-primary-value');

test('Get primary value', (t) => {
  const val = { name: [{ primary: true, value: 'test' }] };
  t.equal(getPrimaryValue(val.name), 'test');
  t.end();
});
