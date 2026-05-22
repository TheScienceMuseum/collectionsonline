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
      // Pull in fixtures/data so the searchbox partial's visualSearchEnabled
      // getter fires (which in turn reads window.__visualSearchEnabled set
      // by client/main.js at boot from the layout meta tag). Without this,
      // the camera entry-point in the searchbox disappears whenever the
      // user navigates SPA-style.
      const pageEl = document.getElementById('main-page');
      if (pageEl) {
        const data = Object.assign({},
          require('../../fixtures/data'),
          {
            navigation: require('../../fixtures/navigation'),
            museums: require('../../fixtures/museums'),
            ready: true,
            titlePage: 'Snap It | Science Museum Group Collection'
          });
        pageEl.innerHTML = Templates.scan(data);
      }
      document.body.className = '';
      document.title = 'Snap It | Science Museum Group Collection';
      // Mirror the server-side dataLayer push for /scan so SPA visits
      // show up the same as direct loads in GA. GTM doesn't auto-fire
      // page views on page.js navigation.
      if (window.dataLayer) {
        window.dataLayer.push({
          pagetype: 'scan',
          pagename: 'Snap It',
          event: 'scanEvent'
        });
      }
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
