const splitOnUnescapedCommas = require('./split-commas.js');

module.exports = (queryString) => {
  const qObj = {};
  Object.keys(queryString).forEach(key => {
    qObj[key] = splitOnUnescapedCommas(queryString[key]);
  });
  return qObj;
};
