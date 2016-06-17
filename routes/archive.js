const fs = require('fs');
const exampleData = JSON.parse(fs.readFileSync('./src/data/archive.json'));

module.exports = () => ({
  method: 'GET',
  path: '/archive',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'archive',
              title: 'The Babbage Papers'
            };

            reply.view('archive', Object.assign(exampleData, data));
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});
