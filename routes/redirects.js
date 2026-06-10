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
  },
  dailyheraldarchive (config) {
    return {
      method: 'GET',
      path: '/documents/aa110073662/{slug?}',
      handler: function (request, h) {
        return h.redirect(config.rootUrl + '/search/collection/daily-herald-archive').permanent();
      }
    };
  },
  snap () {
    // Vanity URL for sharing (press releases, emails) — /snap reads
    // better than /scan. Temporary redirect so the pointer can change
    // without browsers caching it forever. Query strings carry over so
    // UTM campaign parameters survive the redirect for GA attribution.
    return {
      method: 'GET',
      path: '/snap',
      handler: function (request, h) {
        return h.redirect('/scan' + (request.url.search || ''));
      }
    };
  }
};
