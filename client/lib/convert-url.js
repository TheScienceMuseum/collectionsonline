var QueryString = require('querystring');

module.exports = (url, to, from) => {
  var parsedUrl = QueryString.parse(url);
  Object.keys(parsedUrl).forEach(el => {
    if (to === 'html') {
      if (parsedUrl[el].indexOf(',')) {
        parsedUrl[el] = parsedUrl[el].split(',');
      }
    } else if (to === 'json') {
      if (Array.isArray(parsedUrl[el])) {
        parsedUrl[el] = parsedUrl[el].join();
      }
    }
  });
  return decodeURIComponent(QueryString.stringify(parsedUrl));
};
