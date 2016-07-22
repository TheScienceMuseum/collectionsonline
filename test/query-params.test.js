const test = require('tape');
const queryParams = require('../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Should build a query param object from a html request', (t) => {
  t.plan(4);
  const query = {
    query: {
      q: 'ada',
      'fields[type]': 'people',
      'filter[occupation]': 'mathematician',
      'filter[birth[place]]': 'london',
      'filter[birth[date]]': '1800',
      'filter[death[date]]': '1900'
    },
    params: {}
  };

  const result = queryParams('html', query);

  t.equal(result.filter.people.birthPlace[0], 'london', 'filter with place equal "london"');
  t.equal(result.filter.people.birthDate.getFullYear(), 1800, 'filter by birthDate with 1800');
  t.equal(result.filter.people.deathDate.getFullYear(), 1900, 'filter by deathDate with 1900');
  t.equal(result.filter.people.occupation[0], 'mathematician', 'filter by occupation mathematician');
  t.end();
});

test(file + 'Should build a query param object from a json api request', (t) => {
  t.plan(6);
  const query = {
    query: {
      q: 'ada',
      'fields[type]': 'people',
      'filter[occupation]': 'mathematician,developer',
      'filter[birth[place]]': 'london,Paris',
      'filter[birth[date]]': '1800',
      'filter[death[date]]': '1900'
    },
    params: {}
  };

  const result = queryParams('json', query);
  t.equal(result.filter.people.birthPlace[0], 'london', 'filter with place equal "london"');
  t.equal(result.filter.people.birthPlace[1], 'Paris', 'filter with place equal "Paris"');
  t.equal(result.filter.people.birthDate.getFullYear(), 1800, 'filter by birthDate with 1800');
  t.equal(result.filter.people.deathDate.getFullYear(), 1900, 'filter by deathDate with 1900');
  t.equal(result.filter.people.occupation[0], 'mathematician', 'filter by occupation mathematician');
  t.equal(result.filter.people.occupation[1], 'developer', 'filter by occupation developer');
  t.end();
});

test(file + 'Should build a query param object with the value if the format is not html or json', (t) => {
  t.plan(1);
  const query = {
    query: {
      q: 'ada',
      'fields[type]': 'people',
      'filter[occupation]': 'mathematician,developer'
    },
    params: {}
  };

  const result = queryParams('wrongFormat', query);
  t.equal(result.filter.people.occupation, 'mathematician,developer', 'filter by occupation is null');
  t.end();
});

test(file + 'Should convert pageNumber and pageSize to a type number', (t) => {
  t.plan(2);
  const query = {
    query: {
      q: 'ada',
      'page[number]': '2',
      'page[size]': '100'
    },
    params: {}
  };

  const result = queryParams('html', query);
  t.equal(typeof result.pageNumber, 'number', 'pageNumber is a number');
  t.equal(typeof result.pageSize, 'number', 'pageSize is a number');
  t.end();
});
