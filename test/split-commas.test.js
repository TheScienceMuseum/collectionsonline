const test = require('tape');
const splitCommas = require('../client/lib/split-commas');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Split on unescaped comma', (t) => {
  const str = 'Hello\\, there, how are you';
  const result = splitCommas(str);
  t.deepEqual(result, ['Hello\\, there', 'how are you'], 'The string is split on ,');
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

test('Should turn string into array', (t) => {
  const cities = 'London\\, England\\, United Kingdom, Paris\\, France';
  const city = 'London';
  t.plan(2);
  t.ok(Array.isArray(splitCommas(cities)), 'Turns multiple cities into an array');
  t.ok(Array.isArray(splitCommas(city)), 'Turns one city into an array');
  t.end();
});

test('Should split string on unescaped commas', (t) => {
  const cities = 'London\\, England\\, United Kingdom, Paris\\, France';
  const city = 'London';
  t.plan(2);
  t.deepEqual(splitCommas(cities), ['London\\, England\\, United Kingdom', 'Paris\\, France'], 'Correctly splits cities');
  t.deepEqual(splitCommas(city), ['London'], 'Turns one city into an array');
  t.end();
});
