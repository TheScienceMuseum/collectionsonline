var Templates = require('../templates');
var initComp = require('../lib/init-components');
var searchListener = require('../lib/search-listener');

module.exports = function (page) {
  page(render);

  function render (ctx, next) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];
      var data = {};
      data.footer = require('../../fixtures/footer');
      data.footerBanner = require('../../fixtures/footer-banner');
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

