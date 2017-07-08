'use strict';

var handler = require('../handlers/object-id.js');

module.exports = function (elastic, config) {
  var route = {
    method: 'GET',
    path: '/oid/{idObject*}',
    config: { handler: handler(elastic, config) }
  };

  return route;
};
