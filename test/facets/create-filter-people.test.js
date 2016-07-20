const test = require('tape');
const createFilterPeople = require('../../lib/facets/create-filter-people');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'The filters date are included in the array filter', (t) => {
  const queryParams = {
    filter: {
      people: {
        birthDate: new Date('1800'),
        deathDate: new Date('1900')
      }
    }
  };
  const filters = createFilterPeople(queryParams);
  t.equal(filters.length, 2, 'The dates are part of the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format', (t) => {
  const queryParams = {
    filter: {
      people: {
        birthDate: new Date('wrongDateFormat'),
        deathDate: new Date('wrongDateFormat')
      }
    }
  };
  const filters = createFilterPeople(queryParams);
  t.deepEqual(filters, [], 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});
