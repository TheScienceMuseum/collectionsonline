const test = require('tape');
const Handlebars = require('handlebars');

test('Should show 3 pages when only 3 pages are available', (t) => {
  t.plan(2);
  Handlebars.registerHelper('ifmultiplepages', require('../templates/helpers/ifmultiplepages.js'));
  var textHandlebar = '{{#ifmultiplepages totalPages}}multipage!!{{/ifmultiplepages}}';
  var template = Handlebars.compile(textHandlebar);
  var result1page = template({totalPages: 1});
  var resultMultiPage = template({totalPages: 5});
  t.equal(result1page, '', 'text is not displayed if there is only one page');
  t.equal(resultMultiPage, 'multipage!!', 'text displayed for more than one page');
  t.end();
});
