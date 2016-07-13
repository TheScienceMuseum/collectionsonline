const splitOnUnescapedCommas = require('../../client/lib/split-commas.js');
/**
* format the values to the right format depending of the origin of the requst, html or json
*/
module.exports = function (typeFormat, value) {
  if (value) {
    if (typeFormat === 'html') {
      // convert string values to array
      return typeof value === 'string' ? [value] : value;
    }
    if (typeFormat === 'json' && !Array.isArray(value)) {
      return splitOnUnescapedCommas(value);
    }
    return value;
  } else {
    return null;
  }
};
