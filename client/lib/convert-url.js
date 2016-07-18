var QueryString = require('querystring');
var splitOnUnescapedCommas = require('./split-commas.js');
// TODO write do for this function
module.exports = (url, to) => {
  var parsedUrl = QueryString.parse(url);
  Object.keys(parsedUrl).forEach(el => {
    if (to === 'html') {
      var unescapedComma = /[^\\],/g;
      var escapedComma = /\\,/g;
      if (parsedUrl[el].search(unescapedComma) > -1) {
        parsedUrl[el] = splitOnUnescapedCommas(parsedUrl[el]);
      } else {
        parsedUrl[el] = [parsedUrl[el]];
      }
      parsedUrl[el] = parsedUrl[el].map(el => el.replace(escapedComma, ','));
    } else if (to === 'json') {
      if (Array.isArray(parsedUrl[el])) {
        var escapedValues = parsedUrl[el].map(v => { return v.replace(/,/g, '\\,'); });
        parsedUrl[el] = escapedValues.join();
      } else {
        parsedUrl[el] = parsedUrl[el].replace(/,/g, '\\,');
      }
    }
  });
  return decodeURIComponent(QueryString.stringify(parsedUrl));
};
