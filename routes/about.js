// var contentType = require('./route-helpers/content-type.js');
module.exports = () => ({
  method: 'GET',
  path: '/about',
  config: {
    handler: function (request, h) {
      const data = require('../fixtures/data');
      data.footer = require('../fixtures/footer');
      data.museums = require('../fixtures/museums');
      return h.view('about', data);
    }
  }
});
