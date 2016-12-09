const test = require('tape');
const getDescription = require('../lib/helpers/json-to-html-data/get-description.js');

test('Get description from data return null if no description defined', (t) => {
  var data = { type: 'people' };
  t.equal(getDescription(data), null, 'The description is null when no description is defined');
  t.end();
});
