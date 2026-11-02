'use strict';

// CSV export: text cells that a spreadsheet would run as a formula
// (leading = + - @) are prefixed with an apostrophe. Numbers are not.

const test = require('tape');
const exportCsv = require('../lib/ai/export-csv');

function makeFakeDynamo (items) {
  return {
    isReady: function () { return true; },
    scan: function () { return Promise.resolve({ items: items.slice(), lastKey: null }); }
  };
}

function biography (pk, personName) {
  return { entityType: 'BIOGRAPHY', PK: pk, SK: 'BIOGRAPHY', status: 'live', personName };
}

function rowFor (csv, pk) {
  return csv.body.split('\r\n').find(function (line) { return line.indexOf(',' + pk + ',') !== -1; });
}

test('export-csv: formula-like text cells are neutralised', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo([
    biography('cp1', '=HYPERLINK("http://x.test","click")'),
    biography('cp2', '+cmd|calc'),
    biography('cp3', '-2+3'),
    biography('cp4', '@SUM(A1)'),
    biography('cp5', 'Ada Lovelace')
  ]), {}, {});
  t.ok(rowFor(csv, 'cp1').indexOf('"\'=HYPERLINK(""http://x.test"",""click"")"') === 0, '= prefixed and still quoted');
  t.ok(rowFor(csv, 'cp2').indexOf("'+cmd|calc,") === 0, '+ prefixed');
  t.ok(rowFor(csv, 'cp3').indexOf("'-2+3,") === 0, '- prefixed');
  t.ok(rowFor(csv, 'cp4').indexOf("'@SUM(A1),") === 0, '@ prefixed');
  t.ok(rowFor(csv, 'cp5').indexOf('Ada Lovelace,') === 0, 'ordinary text untouched');
  t.end();
});

test('export-csv: numeric cells are not prefixed', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo([
    Object.assign(biography('cp1', 'Ada'), { confidence: -1 })
  ]), {}, {});
  t.ok(/,-1,/.test(rowFor(csv, 'cp1')), 'negative number left as a number');
  t.end();
});
