const Hapi = require('@hapi/hapi');
const routes = require('./routes');
const auth = require('./auth');

module.exports = async (elastic, config, cb) => {
  const server = new Hapi.Server({ port: config.port, routes: { cors: true, log: { collect: true } } });

  server.route(routes(elastic, config));

  if (config.auth) {
    server.route(auth());
    await server.register(require('hapi-auth-jwt2'));
    await server.register(require('./auth/authentication'));
  }

  try {
    await server.register([
      {
        plugin: require('good'),
        options: {
          reporters: {
            console: [{ module: 'good-console' }, 'stdout']
          }
        }
      },
      require('inert'),
      require('vision'),
      require('h2o2'),
      {
        plugin: require('./routes/plugins/error'),
        options: {
          config: config
        }
      }
    ]);
  } catch (err) {
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
};
