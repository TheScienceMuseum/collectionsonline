const test = require('tape');
const unescapeCommas = require('../lib/unescape-commas');

test('Should turn escaped commas into normal commas', (t) => {
  var filter = {terms: {'country': ['London\\, England\\, United Kingdom']}};
  t.plan(1);
  t.equal(unescapeCommas(filter).terms.country[0], 'London, England, United Kingdom', 'Turns escaped commas to normal commas');
  t.end();
});

test('Should not affect normal commas', (t) => {
  var filter = {terms: {'country': ['London, England, United Kingdom']}};
  t.plan(1);
  t.equal(unescapeCommas(filter).terms.country[0], 'London, England, United Kingdom', 'leaves normal commas');
  t.end();
});

test('Should work if some normal commas, some escaped', (t) => {
  var filter = {terms: {'country': ['London\\, England, United Kingdom']}};
  t.plan(1);
  t.equal(unescapeCommas(filter).terms.country[0], 'London, England, United Kingdom', 'Turns escaped commas to normal commas');
  t.end();
});
