const Boom = require('boom');
const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';

// Heavily based on the excellent https://github.com/dwyl/hapi-error
// and https://gist.github.com/wraithgar/231ee3717b4d2da54044
exports.plugin = {
  name: 'hapi-co-error',
  version: '0.0.0',
  register: async (server, options) => {
    options = options || {};

    server.ext('onPreResponse', async (request, h) => {
      // Only interested in errors
      if (!(request.response instanceof Error)) return h.continue;

      const error = new Boom(request.response);
      const accept = request.headers.accept || '';

      if (error.output.statusCode >= 500) {
        console.error(error.stack);
      }

      if (accept.indexOf('text/html') === 0) {
        // Respond with an error template
        if (error.output.statusCode === 401) {
          return h.redirect('/login');
        }

        if (error.output.statusCode === 404) {
          var data = {};
          data.footer = require('../../fixtures/footer');
          data.museums = require('../../fixtures/museums');
          data.items = require('../../fixtures/404.js')(options.config);
          return h.view('404', data).code(404);
        }

        return h
          .view(options.template || 'error', { error, isDevelopment })
          .code(error.output.statusCode);
      }

      if (accept.indexOf('application/vnd.api+json') === 0) {
        // Simply reformat the payload http://jsonapi.org/format/#errors
        request.response.output.payload = {
          errors: [{
            title: error.output.payload.error,
            status: error.output.statusCode,
            detail: error.output.payload.message
          }]
        };
      }

      return h.continue; // Whatever Hapi wants to do...
    });
  }
};
