const Templates = require('../templates');

module.exports = function (page) {
  page('/embed/rotational/:id?', render, listeners);

  function render (ctx, next) {
    const pageEl = document.getElementsByTagName('body')[0];
    pageEl.innerHTML = Templates.rotational();
  }

  function listeners (ctx, next) {}
};
