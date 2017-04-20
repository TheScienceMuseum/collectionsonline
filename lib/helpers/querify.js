// Creates Query String only from relevant parameters
module.exports = function querify (qs) {
  var query = [];
  var include = ['q', 'page[size]', 'page[type]', 'page[number]'];
  Object.keys(qs).forEach(function (el) {
    if (qs[el] && include.indexOf(el) > -1) {
      query.push(el + '=' + qs[el]);
    }
  });

  return query.length ? '?' + query.join('&') : '';
};
