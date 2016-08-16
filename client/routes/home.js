var initJqueryComp = require('../lib/init-jquery-components.js');
var data = require('../../fixtures/data');
var Templates = require('../templates');
var searchListener = require('../lib/search-listener');

module.exports = function (page) {
  page('/', render, listeners);

  function render (ctx, next) {
    var pageEl = document.getElementsByTagName('main')[0];
    pageEl.innerHTML = Templates['home'](data);
    // refresh the title of the page
    document.getElementsByTagName('title')[0].textContent = data.titlePage;
    next();
  }

  function listeners (ctx, next) {
    searchListener();
    initJqueryComp();
  }
};
