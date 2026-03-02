const test = require('tape');
const formatFilterNames = require('../lib/helpers/format-filter-names');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'maps known category values with dashes', (t) => {
  t.deepEqual(formatFilterNames('categories', ['x rays']), ['X-rays'], 'x rays → X-rays');
  t.deepEqual(formatFilterNames('categories', ['medical ceramic ware']), ['Medical Ceramic-ware'], 'medical ceramic ware → Medical Ceramic-ware');
  t.deepEqual(formatFilterNames('categories', ['medical glass ware']), ['Medical Glass-ware'], 'medical glass ware → Medical Glass-ware');
  t.deepEqual(formatFilterNames('categories', ['pharmacy ware']), ['Pharmacy-ware'], 'pharmacy ware → Pharmacy-ware');
  t.deepEqual(formatFilterNames('categories', ['penn gaskell collection']), ['Penn-Gaskell Collection'], 'penn gaskell collection → Penn-Gaskell Collection');
  t.end();
});

test(file + 'lookup is case-insensitive', (t) => {
  t.deepEqual(formatFilterNames('categories', ['Pharmacy Ware']), ['Pharmacy-ware'], 'title-case input maps correctly');
  t.deepEqual(formatFilterNames('categories', ['PHARMACY WARE']), ['Pharmacy-ware'], 'upper-case input maps correctly');
  t.deepEqual(formatFilterNames('categories', ['X Rays']), ['X-rays'], 'title-case X Rays maps correctly');
  t.end();
});

test(file + 'passes through unknown values unchanged', (t) => {
  t.deepEqual(formatFilterNames('categories', ['Textiles']), ['Textiles'], 'unknown category returned as-is');
  t.deepEqual(formatFilterNames('categories', ['Science']), ['Science'], 'plain category returned as-is');
  t.end();
});

test(file + 'handles mixed arrays of known and unknown values', (t) => {
  t.deepEqual(
    formatFilterNames('categories', ['Textiles', 'pharmacy ware', 'Science']),
    ['Textiles', 'Pharmacy-ware', 'Science'],
    'mixed array: known values mapped, unknowns unchanged'
  );
  t.end();
});

test(file + 'handles empty array', (t) => {
  t.deepEqual(formatFilterNames('categories', []), [], 'empty array returns empty array');
  t.deepEqual(formatFilterNames('places', []), [], 'empty array for places returns empty array');
  t.end();
});

test(file + 'handles unknown filterType gracefully', (t) => {
  t.deepEqual(formatFilterNames('nonexistent', ['foo bar']), ['foo bar'], 'unknown filterType returns values unchanged');
  t.deepEqual(formatFilterNames(undefined, ['foo']), ['foo'], 'undefined filterType returns values unchanged');
  t.end();
});

test(file + 'passes through non-array values unchanged (raw string from wrongFormat typeFormat)', (t) => {
  t.equal(formatFilterNames('occupation', 'mathematician,developer'), 'mathematician,developer', 'raw string returned as-is');
  t.equal(formatFilterNames('categories', 'pharmacy ware'), 'pharmacy ware', 'raw string not mapped, returned as-is');
  t.end();
});

test(file + 'handles object_type, material, occupation, places, birth_place, makers, archive, collection (empty maps, passthrough)', (t) => {
  const filterTypes = ['object_type', 'material', 'occupation', 'places', 'birth_place', 'makers', 'archive', 'collection'];
  filterTypes.forEach(function (type) {
    t.deepEqual(formatFilterNames(type, ['some value']), ['some value'], type + ': unknown value returned as-is');
  });
  t.end();
});
