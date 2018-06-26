var Templates = require('../templates');

module.exports = function (page) {
  page('/embed/rotational/:id?', render, listeners);

  function render (ctx, next) {
    var pageEl = document.getElementsByTagName('body')[0];
    pageEl.innerHTML = Templates['rotational'](data);
  }

  function listeners (ctx, next) {}
};
