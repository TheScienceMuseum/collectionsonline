var request = require('request');

module.exports = () => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    handler: function (req, reply) {
      request('https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects', (err, res, body) => {
        if (err) {
          console.error(err);
        }

        return reply({
          museum: 'Science and Media Museum',
          data: JSON.parse(body).filter(e => e.collection_objects.indexOf(req.params.id) > -1)
        });
      });
    }
  }
});
