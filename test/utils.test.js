const test = require('tape');
const utils = require('../lib/helpers/utils');

test('Uppercase First Character', function (t) {
  t.plan(5);

  t.equal(utils.uppercaseFirstChar('hello'), 'Hello', 'Correctly uppercases one word');
  t.equal(utils.uppercaseFirstChar('hello world'), 'Hello World', 'Correctly uppercases multiple words');
  t.equal(utils.uppercaseFirstChar('hello-world'), 'Hello World', 'Correctly uppercases encoded uri components');
  t.equal(utils.uppercaseFirstChar('one and two'), 'One and Two', 'Does not uppercase "and"');
  t.notOk(utils.uppercaseFirstChar(''), 'returns false if no string provided');
  t.end();
});
