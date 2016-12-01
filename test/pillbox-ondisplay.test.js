const test = require('tape');
const pillboxOnDisplay = require('../lib/helpers/search-results-to-template-data/pillbox-ondisplay');

test('Test truncated value for ondisplay', (t) => {
  var selectedFilters = {
    museum: {'Science Museum': true},
    gallery: {'Winton Mathematics Gallery': true}
  };
  var ondisplayValue = pillboxOnDisplay(selectedFilters);
  t.equal(ondisplayValue[0].location, 'Science Museum - Winton Mathematics Gallery', 'Long name location ok');
  t.equal(ondisplayValue[0].shortLocation, 'Science Museum - Winton Mathematics Gall...', 'short name location ok');
  t.end();
});
