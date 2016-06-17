const Hapi = require('hapi');
const routes = require('./routes');

module.exports = (config, cb) => {
  const server = new Hapi.Server();

  server.connection({ port: config.port });

  server.route(routes());

  server.register([
    {
      register: require('good'),
      options: {
        reporters: {
          console: [{ module: 'good-console' }, 'stdout']
        }
      }
    },
    require('inert'),
    require('hapi-negotiator'),
    require('vision')
  ], (err) => {
    if (err) {
      return cb(err);
    }

    server.views({
      engines: { html: { module: require('handlebars'), compileMode: 'sync' } },
      relativeTo: __dirname,
      path: './templates/pages',
      layout: 'default',
      layoutPath: './templates/layouts',
      partialsPath: './templates/partials',
      helpersPath: './templates/helpers'
    });

    cb(null, server);
  });
};
