const tape = require('tape');
const getFirst = require('../lib/get-first.js');
var actual, expected;

tape('getFirst', (t) => {
  actual = getFirst([]);
  expected = null;
  t.equal(actual, expected, 'Empty array');

  actual = getFirst([{type: 'biography', value: 'Biography description'}]);
  expected = 'Biography description';
  t.equal(actual, expected, 'Non note first type');

  actual = getFirst([{type: 'note', value: 'Note description'},
    {type: 'biography', value: 'Biography description'}]);
  expected = 'Biography description';
  t.equal(actual, expected, 'First type is note');

  actual = getFirst([{type: 'note', value: 'Note description'}]);
  expected = null;
  t.equal(actual, expected, 'Only note type');

  t.end();
});
