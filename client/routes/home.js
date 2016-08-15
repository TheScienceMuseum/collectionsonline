var svg4everybody = require('svg4everybody');
var data = require('../../fixtures/data');
var Templates = require('../templates');
var searchListener = require('../lib/search-listener');

module.exports = function (page) {
  page('/', render, listeners);

  function render (ctx, next) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];
      data.footer = require('../../fixtures/footer');
      data.footerBanner = require('../../fixtures/footer-banner');
      pageEl.innerHTML = Templates['home'](data);
      // refresh the title of the page
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      next();
    } else {
      listeners();
    }
  }

  function listeners (ctx, next) {
    searchListener();
    svg4everybody();
  }
};
