'use strict';

const handler = require('../handlers/object-id.js');

module.exports = function (elastic, config) {
  const route = {
    method: 'GET',
    path: '/oid/{idObject*}',
    config: { handler: handler(elastic, config) }
  };

  return route;
};
