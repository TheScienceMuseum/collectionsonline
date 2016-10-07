var jsonContent = require('./route-helpers/json-content.js');
module.exports = () => ({
  method: 'GET',
  path: '/',
  config: {
    handler: function (request, reply) {
      var jsonResponse = jsonContent(request);
      if (jsonResponse) {
        reply('See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api');
      } else {
        const data = require('../fixtures/data');
        data.footer = require('../fixtures/footer');
        data.footerBanner = require('../fixtures/footer-banner');
        reply.view('home', data);
      }
    }
  }
});
