var contentType = require('./route-helpers/content-type.js');
module.exports = () => ({
  method: 'GET',
  path: '/',
  config: {
    handler: function (request, reply) {
      var responseType = contentType(request);
      if (responseType === 'json') {
        return reply('See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api')
        .header('content-type', 'application/vnd.api+json');
      }

      if (responseType === 'html') {
        const data = require('../fixtures/data');
        data.footer = require('../fixtures/footer');
        data.museums = require('../fixtures/museums');
        return reply.view('home', data);
      }

      if (responseType === 'notAcceptable') {
        return reply('Not Acceptable').code(406);
      }
    }
  }
});
