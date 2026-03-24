// Creates Query String only from relevant parameters
module.exports = function querify (qs) {
  const query = [];
  const include = ['q', 'page[size]', 'page[type]', 'page[number]', 'page[sort]', 'pageSize', 'pageNumber', 'pageType', 'pageSort'];
  const mapQS = {
    pageSize: 'page[size]',
    pageType: 'page[type]',
    pageNumber: 'page[number]',
    pageSort: 'page[sort]',
    'page[size]': 'page[size]',
    'page[type]': 'page[type]',
    'page[number]': 'page[number]',
    'page[sort]': 'page[sort]',
    q: 'q'
  };
  Object.keys(qs).forEach(function (el) {
    if (qs[el] && include.indexOf(el) > -1) {
      const key = mapQS[el];
      const val = qs[el];

      // Omit pagination params when they hold default values
      if (key === 'page[number]' && parseInt(val) === 0) return;
      if (key === 'page[size]' && parseInt(val) === 50) return;
      if (key === 'page[sort]' && val === 'default') return;

      query.push(key + '=' + encodeURIComponent(val));
    }
  });
  return query.length ? '?' + query.join('&') : '';
};
