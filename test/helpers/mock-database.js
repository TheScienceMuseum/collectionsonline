const Client = require('@elastic/elasticsearch').Client;
const config = require('../../config');

module.exports = () => {
  function getConfig () {
    return {
      log: 'warning',
      node: config.elasticsearch.node
    };
  }

  return new Client(getConfig());
};
