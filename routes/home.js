module.exports = () => ({
  method: 'GET',
  path: '/',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = require('../fixtures/data');
            data.footer = require('../fixtures/footer');
            data.footerBanner = require('../fixtures/footer-banner');
            reply.view('home', data);
          }
        }
      }
    }
  }
});
