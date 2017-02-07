'use strict';

module.exports = function (elastic, config) {
  var route = {
    method: 'GET',
    path: '/oid/{idObject}',
    config: {
      handler: function (request, reply) {
        return reply('The object id is ' + request.params.idObject);
      }
    }
  };

  return route;
};
