const resources = require('./resources')('object');

module.exports = function (page) {
  page(
    '/group/:id/:slug?',
    resources.load,
    resources.render,
    resources.listeners
  );
};
