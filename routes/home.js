var htmlContent = require('./html-content.js');
module.exports = () => ({
  method: 'GET',
  path: '/',
  config: {
    handler: function (request, reply) {
      var htmlResponse = htmlContent(request);
      if (htmlResponse) {
        const data = require('../fixtures/data');
        data.footer = require('../fixtures/footer');
        data.footerBanner = require('../fixtures/footer-banner');
        reply.view('home', data);
      } else {
        reply('See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api');
      }
    }
  }
});
