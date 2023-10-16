const resources = require('./resources')('object');

module.exports = function (page) {
  page('/objects/:id/:slug?', resources.load, resources.render, resources.listeners);
};
