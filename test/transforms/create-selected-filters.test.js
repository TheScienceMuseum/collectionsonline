const test = require('tape');
const createSelectedFitlers = require('../../lib/transforms/create-selected-filters');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Selected filters should be build from the queryParams', (t) => {
  const queryParams = {
    query: {
      object_type: ['medals', 'photograph'],
      has_image: true,
      image_license: true
    }
  };
  t.plan(1);
  const result = createSelectedFitlers(queryParams);
  const expected = {
    object_type: {
      medals: true,
      photograph: true
    },
    hasImage: { true: true },
    imageLicense: { true: true }
  };
  t.deepEqual(result, expected, 'The selected filters object is build correctly');
  t.end();
});
