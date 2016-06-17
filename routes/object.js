const fs = require('fs');
const exampleData = JSON.parse(fs.readFileSync('./src/data/object.json'));

module.exports = () => ({
  method: 'GET',
  path: '/object',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'object',
              title: 'Difference Engine No 1'
            };

            reply.view('object', Object.assign(exampleData, data));
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});
