const test = require('tape');
const formatDescription = require('../../templates/helpers/format-description.js');

test('Description should be returned as an handlebars object', function (t) {
  t.plan(3);
  const description = 'hello world';
  const formattedDescription = formatDescription(description);

  t.equal(typeof formattedDescription, 'object', 'formatted description should be a handlebars object');
  t.ok(formattedDescription.string, 'formatted description should have a string property');
  t.ok(formattedDescription.string.indexOf('<p>') > -1, 'formatted string should have a p tag');
  t.end();
});

test('Long Description should be split up', function (t) {
  t.plan(1);
  const description = `
    hello world\nhello world\nhello world\nhello world\nhello world\n
    hello world\nhello world\nhello world\nhello world\nhello world\n
    hello world\nhello world\nhello world\nhello world\nhello world\n
    hello world\nhello world\nhello world\nhello world\nhello world\n`;
  const formattedDescription = formatDescription(description);

  t.ok(formattedDescription.string.indexOf('More…') > -1, 'formatted string should have a more.. div');
  t.end();
});
