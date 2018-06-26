module.exports = () => ({
  method: 'GET',
  path: '/embed/rotational/{id}',
  config: {
    handler: function (request, reply) {
      return reply.view(
        'rotational',
        { id: request.params.id },
        { layout: 'embed' }
      );
    }
  }
});
