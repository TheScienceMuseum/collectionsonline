const resources = require('./resources')('group');
module.exports = function (page) {
  page(
    '/group/:id/:slug?',
    resources.load,
    resources.render,
    resources.listeners
  );
};
