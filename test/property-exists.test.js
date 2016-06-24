const test = require('tape');
const propertyExists = require('../lib/property-exists');
const obj = {1: {2: {3: ['hello']}}};

test('Calling PropertyExists should not throw an error', function (t) {
  t.plan(2);
  t.doesNotThrow(() => propertyExists(obj, '1.2.3.0'), 'Function does not throw error');
  t.notOk(propertyExists(obj, '1.2.hi.world'), 'Function does not throw error');
  t.end();
});

test('Calling PropertyExists should return the correct property', function (t) {
  t.plan(2);
  t.ok(propertyExists(obj, '1.2.3.0'), 'Function returns a result');
  t.equal(propertyExists(obj, '1.2.3.0'), 'hello', 'Function returns corect result');
  t.end();
});

test('Calling PropertyExists should return false if property is not found', function (t) {
  t.plan(1);
  t.notOk(propertyExists(obj, '1.2.hi.world'), 'Function does not return a result');
  t.end();
});
