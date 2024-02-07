const test = require('tape');
const JSONToHTML = require('../lib/transforms/json-to-html-data');

test('Normal date and place test', (t) => {
  t.plan(7);

  const resource = {
    data: {
      type: 'objects',
      attributes: {
        creation: {
          date: [{ value: '1912' }]
        }
      },
      links: { root: 'http://localhost:8000' },
      record: {
        groupingType: 'SPH'
      }
    },
    included: [
      {
        type: 'place',
        attributes: {
          role: {
            value: 'made'
          },
          summary: {
            title: 'London'
          }
        }
      }
    ]
  };
  const JSONData = JSONToHTML(resource);
  const made = JSONData.fact.find(el => el.key === 'Made');

  t.ok(made, 'Data has facts');
  t.ok(made.place, 'Data has a place');
  t.ok(made.date, 'Data has a date');
  t.ok(made.place.find(e => e.value === 'London'), 'Made location is correct');
  t.equal(made.date.value, '1912', 'Made date is correct');
  t.ok(made.place.find(e => e.link === 'http://localhost:8000/search/places/london'), 'Place Link is correct');
  t.equal(made.date.link, 'http://localhost:8000/search/date[from]/1912/date[to]/1912', 'Date link is correct');
  t.end();
});

test('date range test', (t) => {
  t.plan(1);

  const resource = {
    data: {
      type: 'objects',
      attributes: {
        creation: {
          date: [{ value: '1912-1917' }]
        }
      },
      links: { root: 'http://localhost:8000' }
    },
    included: [
      {
        type: 'place',
        attributes: {
          role: {
            value: 'made'
          },
          summary: {
            title: 'London'
          }
        }
      }
    ]
  };
  const JSONData = JSONToHTML(resource);
  const made = JSONData.fact.find(el => el.key === 'Made');

  t.equal(made.date.link, 'http://localhost:8000/search/date[from]/1912/date[to]/1917', 'Handles date ranges correctly');
  t.end();
});

test('bad date test', (t) => {
  t.plan(1);

  const resource = {
    data: {
      type: 'objects',
      attributes: {
        creation: {
          date: [{ value: '1-91-2/1917' }]
        }
      },
      links: { root: 'http://localhost:8000' }
    },
    included: [
      {
        type: 'place',
        attributes: {
          role: {
            value: 'made'
          },
          summary: {
            title: 'London'
          }
        }
      }
    ]
  };
  const JSONData = JSONToHTML(resource);
  const made = JSONData.fact.find(el => el.key === 'Made');

  t.notOk(made.date.link, 'Ignores malformed dates');
  t.end();
});

test('bad date range test', (t) => {
  t.plan(1);

  const resource = {
    data: {
      type: 'objects',
      attributes: {
        creation: {
          date: [{ value: '1912-19FG=17' }]
        }
      },
      links: { root: 'http://localhost:8000' }
    },
    included: [
      {
        type: 'place',
        attributes: {
          role: {
            value: 'made'
          },
          summary: {
            title: 'London'
          }
        }
      }
    ]
  };
  const JSONData = JSONToHTML(resource);
  const made = JSONData.fact.find(el => el.key === 'Made');

  t.equal(made.date.link, 'http://localhost:8000/search/date[from]/1912/date[to]/1912', 'uses one date if only one is good');
  t.end();
});
