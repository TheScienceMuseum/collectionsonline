const test = require('tape');
const createSelectedFitlers = require('../../lib/transforms/create-selected-filters');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Selected filters should be build from the queryParams', (t) => {
  var queryParams = {
    filter: {
      objects: {
        type: ['medals', 'photograph']
      }
    }
  };
  t.plan(1);
  var result = createSelectedFitlers(queryParams);
  var expected = {
    type: {
      medals: true,
      photograph: true
    }
  };
  t.deepEqual(result, expected, 'The selected filters object is build correctly');
  t.end();
});
