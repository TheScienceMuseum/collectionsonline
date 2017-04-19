const Client = require('elasticsearch').Client;
const config = require('../config');
const elastic = new Client(config.elasticsearchAdmin);

module.exports = elastic;
