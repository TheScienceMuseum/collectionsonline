var Templates = require('../templates');
var initComp = require('../lib/listeners/init-components');
var searchListener = require('../lib/listeners/search-listener');

module.exports = function (page) {
  page(render);

  function render (ctx, next) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementById('main-page');
      var data = {};
      data.navigation = require('../../fixtures/navigation');
      data.museums = require('../../fixtures/museums');
      data.items = require('../../fixtures/404.js');
      pageEl.innerHTML = Templates['404'](data);
      // refresh the title of the page
      document.getElementsByTagName('title')[0].textContent = 'Page not found';
      next();
    } else {
      listeners();
    }
  }

  function listeners (ctx, next) {
    searchListener();
    initComp();
  }
};
