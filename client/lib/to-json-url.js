/**
* Create a flatten escaped encoded json type url values
*/
var QueryString = require('querystring');
module.exports = function (queryString) {
  var qs = QueryString.parse(queryString);
  // escape value
  Object.keys(qs).forEach(function (k) {
    if (Array.isArray(qs[k])) {
      qs[k].forEach(function (v, i) {
        qs[k][i] = v.replace(/,/g, '\\,');
      });
      qs[k] = qs[k].join();
    } else {
      qs[k] = qs[k].replace(/,/g, '\\,');
    }
  });
  qs.ajax = true;
  return QueryString.stringify(qs);
};
