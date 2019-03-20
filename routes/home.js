var contentType = require('./route-helpers/content-type.js');
module.exports = () => ({
  method: 'GET',
  path: '/',
  config: {
    handler: function (request, h) {
      var responseType = contentType(request);
      if (responseType === 'json') {
        return h.response('See https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API on how to use the api');
      }

      if (responseType === 'html') {
        const data = require('../fixtures/data');
        data.footer = require('../fixtures/footer');
        data.museums = require('../fixtures/museums');
        return h.view('home', data);
      }

      if (responseType === 'notAcceptable') {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});
