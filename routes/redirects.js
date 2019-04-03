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
  }
};

