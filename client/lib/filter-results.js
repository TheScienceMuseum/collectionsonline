/**
 * Collect the filter values, build and call the new url with the filter query parameters
 */
const Querystring = require('querystring');
const getQueryString = require('./get-qs');
const findCategory = require('./find-category.js');

module.exports = function (ctx, page) {
  const searchCategory = findCategory(ctx.pathname);
  const currentQueryString = Querystring.parse(ctx.querystring);
  const pageType = currentQueryString['page[type]']
    ? currentQueryString['page[type]']
    : 'search';
  const url =
    '/search' +
    (searchCategory ? '/' + searchCategory : '') +
    getQueryString(pageType, searchCategory);
  // console.log(url, 'checking url');
  page.show(url);
};
