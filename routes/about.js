var contentType = require('./route-helpers/content-type.js');
module.exports = () => ({
  method: 'GET',
  path: '/about',
  config: {
    handler: function (request, reply) {
      const data = require('../fixtures/data');
      data.footer = require('../fixtures/footer');
      data.museums = require('../fixtures/museums');
      return reply.view('about', data);
    }
  }
});
