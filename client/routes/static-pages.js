const Templates = require('../templates');
const initComp = require('../lib/listeners/init-components');
const searchListener = require('../lib/listeners/search-listener');

function renderStaticPage (templateName, extraData) {
  return function (ctx, next) {
    if (ctx.isInitialRender) {
      searchListener();
      initComp();
    } else {
      const pageEl = document.getElementById('main-page');
      const data = require('../../fixtures/data');
      data.navigation = require('../../fixtures/navigation');
      data.museums = require('../../fixtures/museums');
      if (extraData) Object.assign(data, extraData);
      document.body.className = '';
      pageEl.innerHTML = Templates[templateName](data);
      document.getElementsByTagName('title')[0].textContent = data.titlePage;
      searchListener();
      requestAnimationFrame(() => {
        initComp();
        requestAnimationFrame(() => window.dispatchEvent(new window.Event('resize')));
      });
    }
  };
}

module.exports = function (page) {
  page('/explore', renderStaticPage('explore', { explore: require('../../fixtures/explore'), titlePage: 'Explore | Science Museum Group Collection' }));
  page('/about', renderStaticPage('about', { titlePage: 'About | Science Museum Group Collection' }));
};
