module.exports = {
  random () {
    return {
      method: 'GET',
      path: '/random',
      handler: function (request, h) {
        return h.redirect('/search/slideshow');
      }
    };
  },
  medicine () {
    return {
      method: 'GET',
      path: '/search/categories/oriental-medicine',
      handler: function (request, h) {
        return h.redirect('/search/categories/asian-medicine');
      }
    };
  },
  dailyherald (config) {
    return {
      method: 'GET',
      path: '/objects/co205344/{slug?}',
      handler: function (request, h) {
        return h.redirect(config.rootUrl + '/search/collection/daily-herald-archive').permanent();
      }
    };
  }
};
