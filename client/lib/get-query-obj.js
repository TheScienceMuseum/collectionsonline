var splitOnUnescapedCommas = require('./split-commas.js');

module.exports = (queryString) => {
  var qObj = {};
  Object.keys(queryString).forEach(key => {
    qObj[key] = splitOnUnescapedCommas(queryString[key]);
  });
  return qObj;
};
