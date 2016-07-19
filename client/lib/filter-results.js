/**
* Collect the filter values, build and call the new url with the filter query parameters
*/
var getQueryString = require('./get-qs');
module.exports = function (ctx, page) {
  var url = ctx.pathname + '?' + getQueryString();
  page.show(url);
};
