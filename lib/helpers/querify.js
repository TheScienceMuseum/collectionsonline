// Creates Query String only from relevant parameters
module.exports = function querify (qs) {
  var query = [];
  var include = ['q', 'page[size]', 'page[type]', 'page[number]', 'pageSize', 'pageNumber', 'pageType'];
  var mapQS = {
    'pageSize': 'page[size]',
    'pageType': 'page[type]',
    'pageNumber': 'page[number]',
    'page[size]': 'page[size]',
    'page[type]': 'page[type]',
    'page[number]': 'page[number]',
    'q': 'q'
  };
  Object.keys(qs).forEach(function (el) {
    if (qs[el] && include.indexOf(el) > -1) {
      if (qs[el] !== 'page[size]' || parseInt(qs[el]) !== 50) {
        query.push(mapQS[el] + '=' + encodeURIComponent(qs[el]));
      }
    }
  });
  return query.length ? '?' + query.join('&') : '';
};
