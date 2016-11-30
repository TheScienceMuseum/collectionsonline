const test = require('tape');
const truncate = require('../lib/helpers/search-results-to-template-data/truncate');

test('Should convert to external types', (t) => {
  t.equal(truncate('hello there', 5), 'hello...', 'truncate with maxChar 5');
  t.equal(truncate('hello there', 50), 'hello there', 'return all value if maxChar > value.length');
  t.equal(truncate('', 50), undefined, 'return undefined when the value is empty or not defined');
  t.end();
});
