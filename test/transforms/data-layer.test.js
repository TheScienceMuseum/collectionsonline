const test = require('tape');
const dataLayer = require('../../lib/transforms/data-layer');

test('data-layer return right object', (t) => {
  t.plan(1);
  var data = [
    {
      key: 'part of archive',
      value: 'Babbage'
    },
    {
      key: 'maker',
      value: 'Babbage'
    },
    {
      key: 'Made',
      date: {
        value: '1820'
      }
    }
  ];

  const layer = dataLayer('documents', data);
  const expected = JSON.stringify({
    'Level1': 'documents',
    'Level2': 'Babbage',
    'Level3': 'Babbage',
    'Level4': '1820'
  });
  t.equal(layer, expected, 'The layer for documents is ok');
  t.end();
});
