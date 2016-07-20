const test = require('tape');
const splitCommas = require('../client/lib/split-commas');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Split on unescaped comma', (t) => {
  const str = 'Hello\\, there, how are you';
  const result = splitCommas(str);
  t.deepEqual(result, ['Hello\\, there', ' how are you'], 'The string is split on ,');
  t.plan(1);
  t.end();
});

test(file + 'Should not split if there are no commas', (t) => {
  const str = 'Hello there how are you';
  const result = splitCommas(str);
  t.deepEqual(result, ['Hello there how are you'], 'The string is return as a one value');
  t.plan(1);
  t.end();
});

test(file + 'Should not split on \\,', (t) => {
  const str = 'Hello there\\, how are you';
  const result = splitCommas(str);
  t.deepEqual(result, ['Hello there\\, how are you'], 'The string is return as a one value');
  t.plan(1);
  t.end();
});
