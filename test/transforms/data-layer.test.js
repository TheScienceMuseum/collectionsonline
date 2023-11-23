const test = require('tape');
const dataLayer = require('../../lib/transforms/data-layer');

test('data-layer return right object for documnents', (t) => {
  t.plan(1);
  const data = [
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
    recordType: 'documents',
    recordArchive: 'Babbage',
    recordMaker: 'Babbage',
    recordMade: '1820'
  });
  t.equal(layer, expected, 'The layer for documents is ok');
  t.end();
});

test('data-layer return right object for people', (t) => {
  t.plan(1);
  const data = [
    {
      key: 'occupation',
      value: [{ value: 'mathematician' }]
    },
    {
      key: 'born in',
      value: 'Southwark'
    },
    {
      key: 'Nationality',
      value: 'British'
    }
  ];

  const layer = dataLayer('people', data);
  const expected = JSON.stringify({
    recordType: 'people',
    recordOccupation: ['mathematician'],
    recordBorn: 'Southwark',
    recordNationality: 'British'
  });
  t.equal(layer, expected, 'The layer for people is ok');
  t.end();
});
