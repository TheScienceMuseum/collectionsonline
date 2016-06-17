const config = require('../config');
const createServer = require('../server');

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

  server.start((err) => {
    if (err) {
      throw err;
    }
    console.log(server.info.uri);
  });
});
