const test = require('tape');
const getPrimaryValue = require('../lib/get-primary-value.js');

test('Get primary value of a string return the sting', (t) => {

  t.equal(getPrimaryValue('hello'), 'hello', 'get primary value of hello is hello');
  t.end();
});
