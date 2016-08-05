module.exports = () => ({
  method: 'GET',
  path: '/login',
  config: {
    auth: false
  },
  handler: (request, reply) => reply.view('login', null, {layout: 'auth'})
});
