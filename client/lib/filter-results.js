/**
* Collect the filter values, build and call the new url with the filter query parameters
*/
var Querystring = require('querystring');
var getQueryString = require('./get-qs');
var findCategory = require('./find-category.js');

module.exports = function (ctx, page) {
  var searchCategory = findCategory(ctx.pathname);
  var currentQueryString = Querystring.parse(ctx.querystring);
  var pageType = currentQueryString['page[type]'] ? currentQueryString['page[type]'] : 'search';
  var url = '/search' + (searchCategory ? '/' + searchCategory : '') + getQueryString(pageType, searchCategory);
  page.show(url);
};
