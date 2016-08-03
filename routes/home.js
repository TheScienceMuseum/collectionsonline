module.exports = () => ({
  method: 'GET',
  path: '/',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            console.log(process.env);
            console.log('##########');
            const data = require('../fixtures/data');
            reply.view('home', data);
          }
        }
      }
    }
  }
});
