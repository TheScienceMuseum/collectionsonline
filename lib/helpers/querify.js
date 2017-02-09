// Creates Query String only from relevant parameters
module.exports = function querify (qs) {
  var query = [];
  Object.keys(qs).forEach(function (el) {
    if ((el === 'q' || el === 'page[size]' || el === 'page[type]') && qs[el]) {
      query.push(el + '=' + qs[el]);
    }
  });

  return query.length ? '?' + query.join('&') : '';
}
