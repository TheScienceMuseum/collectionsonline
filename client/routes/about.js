var page = require('page');
var Templates = require('../templates');
var initComp = require('../lib/listeners/init-components');

// module.exports = function (page) {
//   page('/about', render, listeners);
//
//   function render (ctx, next) {
//     var pageEl = document.getElementsByTagName('body')[0];
//     data.footer = require('../../fixtures/footer');
//     data.museums = require('../../fixtures/museums');
//     pageEl.innerHTML = Templates['about']();
//   }
//
//   function listeners (ctx, next) {}
// };

module.exports = function (page) {
  page('/about', render, listeners);

  function render (ctx, next) {
    if (!ctx.isInitialRender) {
      var pageEl = document.getElementsByTagName('main')[0];
      data.footer = require('../../fixtures/footer');
      data.museums = require('../../fixtures/museums');
      pageEl.innerHTML = Templates['about'](data);
      // refresh the title of the page
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      document.body.className = ctx.state.data.type;
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
