const fs = require('fs');
const exampleData = JSON.parse(fs.readFileSync('./src/data/person.json'));

module.exports = () => ({
  method: 'GET',
  path: '/person',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'person',
              title: 'Charles Babbage'
            };

            reply.view('person', Object.assign(exampleData, data));
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});
