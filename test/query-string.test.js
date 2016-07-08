const test = require('tape');
const getQueryString = require('../client/lib/get-qs');

test('Should add a filter to a query string', (t) => {
  t.plan(1);
  const e = {
    target: {
      name: 'filter[occupation]',
      value: 'watchmaker'
    }
  };
  const ctx = {
    state: {
      data: {
        selectedFilters: {
          'filter[occupation]': {
            'poster artist': true,
            'silversmith': true
          }
        }
      }
    }
  };
  const queryString = {q: 'Jonathan', 'filter[occupation]': 'poster artist,silversmith,watchmaker'};
  t.deepEqual(getQueryString(e, ctx, 'Jonathan'), queryString, 'Adds a filter');
});

test('Should add a filter category to a query string', (t) => {
  t.plan(1);
  const e = {
    target: {
      name: 'filter[occupation]',
      value: 'watchmaker'
    }
  };
  const ctx = {
    state: {
      data: {
        selectedFilters: {}
      }
    }
  };
  const queryString = {q: 'Jonathan', 'filter[occupation]': 'watchmaker'};
  t.deepEqual(getQueryString(e, ctx, 'Jonathan'), queryString, 'Adds a filter');
});

test('Should remove a filter from a query string', (t) => {
  t.plan(1);
  const e = {
    target: {
      name: 'filter[occupation]',
      value: 'silversmith'
    }
  };
  const ctx = {
    state: {
      data: {
        selectedFilters: {
          'filter[occupation]': {
            'poster artist': true,
            'silversmith': true
          }
        }
      }
    }
  };
  const queryString = {q: 'Jonathan', 'filter[occupation]': 'poster artist'};
  t.deepEqual(getQueryString(e, ctx, 'Jonathan'), queryString, 'Removes a filter');
});

test('Should remove all filters from a query string', (t) => {
  t.plan(1);
  const e = {
    target: {
      name: 'filter[occupation]',
      value: 'poster artist'
    }
  };
  const ctx = {
    state: {
      data: {
        selectedFilters: {
          'filter[occupation]': {
            'poster artist': true
          }
        }
      }
    }
  };
  const queryString = {q: 'Jonathan'};
  t.deepEqual(getQueryString(e, ctx, 'Jonathan'), queryString, 'Removes all filters');
});

test('Should not remove filters with similar names', (t) => {
  t.plan(1);
  const e = {
    target: {
      name: 'filter[occupation]',
      value: 'artist'
    }
  };
  const ctx = {
    state: {
      data: {
        selectedFilters: {
          'filter[occupation]': {
            'poster artist': true
          }
        }
      }
    }
  };
  const queryString = {q: 'Jonathan', 'filter[occupation]': 'poster artist,artist'};
  t.deepEqual(getQueryString(e, ctx, 'Jonathan'), queryString, 'Removes all filters');
});
