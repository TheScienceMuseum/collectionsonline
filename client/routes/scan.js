// Client-side bootstrap for /scan. Server renders the page (Handlebars
// template includes the idle state markup); we just attach the
// controller, which manages camera + capture + (eventually) embedding.

const Templates = require('../templates');
const initComp = require('../lib/listeners/init-components');
const searchListener = require('../lib/listeners/search-listener');
const { createController } = require('../lib/visual-search/controller');

const MOUNT_ID = 'scan-app';

function boot () {
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return;
  const controller = createController(mount);
  controller.boot();
}

module.exports = function (page) {
  page('/scan', function (ctx) {
    if (ctx.isInitialRender) {
      // Server already rendered the full page; just attach behaviour.
      searchListener();
      initComp();
      boot();
    } else {
      // SPA navigation from another page: render the template ourselves.
      const pageEl = document.getElementById('main-page');
      if (pageEl) {
        pageEl.innerHTML = Templates.scan({
          ready: true,
          titlePage: 'Scan an object | Science Museum Group Collection'
        });
      }
      document.body.className = '';
      document.title = 'Scan an object | Science Museum Group Collection';
      searchListener();
      requestAnimationFrame(function () {
        initComp();
        boot();
        requestAnimationFrame(function () {
          window.dispatchEvent(new window.Event('resize'));
        });
      });
    }
  });
};
