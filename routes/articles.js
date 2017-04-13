var Boom = require('boom');
var request = require('request');

module.exports = () => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    handler: function (req, reply) {
      request('https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects', (err, res, body) => {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        reply({
          museum: 'Science and Media Museum',
          data: JSON.parse(body).filter(e => e.collection_objects.indexOf(req.params.id) > -1)
        });
      });
    }
  }
});
