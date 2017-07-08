var resources = require('./resources')('people');

module.exports = function (page) {
  page('/people/:id/:slug?', resources.load, resources.render, resources.listeners);
};
