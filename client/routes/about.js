var page = require('page');
var Templates = require('../templates');
var initComp = require('../lib/listeners/init-components');

module.exports = function (page) {
  page('/about', render, listeners);

  function render (ctx, next) {
    var pageEl = document.getElementsByTagName('body')[0];
    pageEl.innerHTML = Templates['about']();
  }

  function listeners (ctx, next) {}
};
