const test = require('tape');
const getNestedProperty = require('../lib/nested-property');
const obj = {1: {2: {3: ['hello']}}};

test('Calling getNestedProperty should not throw an error', function (t) {
  t.plan(2);
  t.doesNotThrow(() => getNestedProperty(obj, '1.2.3.0'), 'Function does not throw error');
  t.notOk(getNestedProperty(obj, '1.2.hi.world'), 'Function does not throw error');
  t.end();
});

test('Calling getNestedProperty should return the correct property', function (t) {
  t.plan(2);
  t.ok(getNestedProperty(obj, '1.2.3.0'), 'Function returns a result');
  t.equal(getNestedProperty(obj, '1.2.3.0'), 'hello', 'Function returns corect result');
  t.end();
});

test('Calling getNestedProperty should return false if property is not found', function (t) {
  t.plan(1);
  t.notOk(getNestedProperty(obj, '1.2.hi.world'), 'Function does not return a result');
  t.end();
});
