var request = require('request');

module.exports = () => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    handler: function (req, reply) {
      var articles = [];
      var called = 0;

      // NMeM Bradford
      request('https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects', (err, res, body) => {
        called++;
        if (err) {
          console.error(err);
        }
        var data = JSON.parse(body).filter(e => e.collection_objects.indexOf(req.params.id) > -1);
        if (data.length) {
          articles.push({
            museum: 'Science and Media Museum',
            data: data
          });
        }
        complete();
      });

      // MSI Manchester
      request('https://www.msimanchester.org.uk/collection-media/collection-usage/objects', (err, res, body) => {
        called++;
        if (err) {
          console.error(err);
        }
        var data = JSON.parse(body).filter(e => e.collection_objects.indexOf(req.params.id) > -1);
        if (data.length) {
          articles.push({
            museum: 'MSI Manchester',
            data: data
          });
        }
        complete();
      });

      function complete () {
        if (called === 2) {
          return reply({data: articles});
        }
      }
    }
  }
});
