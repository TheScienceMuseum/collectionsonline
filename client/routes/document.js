const resources = require('./resources')('document');

module.exports = function (page) {
  page('/documents/:id/:slug?', resources.load, resources.render, resources.listeners);
};
