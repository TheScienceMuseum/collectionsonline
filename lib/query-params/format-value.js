const splitOnUnescapedCommas = require('../../client/lib/split-commas.js');
/**
* format the values to the right format depending of the origin of the requst, html or json
* The values are converted to an array
* html: The value is a string if only one filter is selected otherwise it's an array
* json: The value is always a string. the comma separate multiple value the \, is part of the value
*/
module.exports = function (typeFormat, value) {
  if (value) {
    if (typeFormat === 'html') {
      return typeof value === 'string' ? [value] : value;
    }
    if (typeFormat === 'json' && !Array.isArray(value)) {
      if (typeof value === 'number') {
        return value;
      } else {
        return splitOnUnescapedCommas(value).map(function (v) {
          return v.replace(/\\,/g, ',');
        });
      }
    }
    return value;
  } else {
    return null;
  }
};
