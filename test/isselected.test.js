const test = require('tape');
const isSelected = require('../templates/helpers/isselected.js');

test('Should check correctly', (t) => {
  const selected = {
    'filter[occupation]': {
      'artist': true
    }
  };
  t.plan(2);
  t.equal(isSelected(selected, 'filter[occupation]', 'artist'), 'checked', 'Is checked if selected');
  t.equal(isSelected(selected, 'filter[occupation]', 'author'), '', 'Is not checked if not selected');
  t.end();
});

test('Should parse commas correctly', (t) => {
  const selected = {
    'filter[birth[place]]': {
      'London\\, United Kingdom': true
    }
  };
  t.plan(1);
  t.equal(isSelected(selected, 'filter[birth[place]]', 'London, United Kingdom'), 'checked', 'Commas parsed correctly');
  t.end();
});
