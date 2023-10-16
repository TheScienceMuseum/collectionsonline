const test = require('tape');
const createClearFacetLinks = require('../../lib/transforms/create-clear-facet-links');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const QueryString = require('querystring');
const queryParams = require('../../lib/query-params/query-params');

test(file + 'Selected filters should be build from the queryParams', (t) => {
  const url = 'q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Bsize%5D=50';
  const qp = queryParams('html', { query: QueryString.parse(url), params: {} });
  const links = createClearFacetLinks(qp, 'http://localhost:8000');
  t.plan(1);
  t.equal(links.dates, 'http://localhost:8000/search?q=ada&page[size]=50', 'The clear filter dates link is ok');
  t.end();
});

test(file + 'page type link', (t) => {
  const url = 'q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Btype%5D=results-list';
  const qp = queryParams('html', { query: QueryString.parse(url), params: {} });
  const links = createClearFacetLinks(qp, 'http://localhost:8000');
  t.plan(1);
  t.equal(links.dates, 'http://localhost:8000/search?q=ada&page[type]=results-list', 'The clear filter dates link is ok');
  t.end();
});
