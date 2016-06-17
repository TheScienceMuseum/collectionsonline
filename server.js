const Hapi = require('hapi');
const routes = require('./routes');

module.exports = ({ elastic, config }, cb) => {
  const server = new Hapi.Server();

  server.connection({ port: config.port });

  server.route(routes({ elastic, config }));

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
    require('vision'),
    require('./routes/plugins/error')
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

    cb(null, { server, elastic });
  });
};
