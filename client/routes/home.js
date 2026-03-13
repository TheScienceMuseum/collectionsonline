const Templates = require('../templates');
const initComp = require('../lib/listeners/init-components');
const searchListener = require('../lib/listeners/search-listener');

module.exports = function (page) {
  page('/', render);

  function render (ctx, next) {
    if (ctx.isInitialRender) {
      searchListener();
      initComp();
    } else {
      const pageEl = document.getElementById('main-page');
      const data = require('../../fixtures/data');
      data.navigation = require('../../fixtures/navigation');
      data.museums = require('../../fixtures/museums');
      document.body.className = '';
      pageEl.innerHTML = Templates.home(data);
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      searchListener();
      requestAnimationFrame(() => {
        initComp();
        requestAnimationFrame(() => window.dispatchEvent(new window.Event('resize')));
      });
    }
  }
};
