const tape = require('tape');
const createServer = require('../../server');
const config = require('../../config');

module.exports = (description, cb) => {
  createServer(config, (err, server) => {
    if (err) {
      throw err;
    }

    server.views({
      engines: {
        html: require('handlebars')
      },
      path: 'src/pages',
      layout: true,
      layoutPath: './src/layouts',
      helpersPath: './src/helpers',
      partialsPath: './src/partials'
    });

    tape(description, (t) => {
      cb(t, server);
    });
  });
};
