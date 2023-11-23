const test = require('tape');
const Handlebars = require('handlebars');

test('Should show 3 pages when only 3 pages are available', (t) => {
  t.plan(2);
  Handlebars.registerHelper('ifmultiple', require('../templates/helpers/ifmultiple.js'));
  const textHandlebar = '{{#ifmultiple totalPages}}multipage!!{{/ifmultiple}}';
  const template = Handlebars.compile(textHandlebar);
  const result1page = template({ totalPages: 1 });
  const resultMultiPage = template({ totalPages: 5 });
  t.equal(result1page, '', 'text is not displayed if there is only one page');
  t.equal(resultMultiPage, 'multipage!!', 'text displayed for more than one page');
  t.end();
});
