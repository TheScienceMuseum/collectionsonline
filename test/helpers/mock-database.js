const Client = require('elasticsearch').Client;
const config = require('../../config');

module.exports = () => {
  function getConfig () {
    return {
      log: 'warning',
      host: config.elasticsearch.host
    };
  }

  return new Client(getConfig());
};
