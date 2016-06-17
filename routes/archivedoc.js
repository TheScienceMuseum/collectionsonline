module.exports = () => ({
  method: 'GET',
  path: '/archivedoc',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'archivedoc',
              title: 'End view of inking printing paper and stereotyping apparatus. Tracing of BAB A/172'
            };

            reply.view('archivedoc', data);
          },
          'application/vnd.api+json' (req, reply) {
            reply('"{"response": "JSONAPI"}"').header('content-type', 'application/vnd.api+json');
          }
        }
      }
    }
  }
});
