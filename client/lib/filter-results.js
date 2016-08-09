/**
* Collect the filter values, build and call the new url with the filter query parameters
*/
var Querystring = require('querystring');
var getQueryString = require('./get-qs');
module.exports = function (ctx, page) {
  var currentQueryString = Querystring.parse(ctx.querystring);
  var pageType = currentQueryString['page[type]'] ? currentQueryString['page[type]'] : 'search';
  var url = ctx.pathname + '?' + getQueryString() + '&page[type]=' + pageType;
  page.show(url);
};
