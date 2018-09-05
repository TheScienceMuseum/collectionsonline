var request = require('request');
var async = require('async');

// Article endpoints on each musuem website
var endpoints = [
  { label: 'National Science and Media Museum', url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science and Industry Musem', url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science Museum', url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects' }
];

module.exports = () => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    handler: function (req, reply) {
      async.concat(endpoints, function (endpoint, callback) {
        request({
          'rejectUnauthorized': false,
          'url': endpoint.url
        }, (err, res, body) => {
          if (err) return callback(err);
          try {
            var data = JSON.parse(body).filter(e => e.collection_objects.indexOf(req.params.id) > -1);
            if (data.length) {
              return callback(null, {
                museum: endpoint.label,
                data: data
              });
            }
          } catch (e) {
            return callback('Cannot parse related objects feed from ' + endpoint.url);
          }
          callback();
        });
      },
      function (err, articles) {
        if (err) { console.error(err); }
        return reply({ data: articles });
      });
    }
  }
});

