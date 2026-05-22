require('./lib/polyfills.js')();
const page = require('page');

// Pick up the visual-search feature flag from the server's initial
// render (gated meta tag in templates/layouts/default.html), stash on
// window for any direct consumers, AND replace the fixtures/data.js
// getter with a plain boolean so SPA-rendered Handlebars partials see
// it reliably. The getter form worked for top-level property access
// but didn't survive partial-context handling consistently across
// templates (camera entry-point in the searchbox kept disappearing on
// SPA navigation). A plain value cuts the indirection.
(function () {
  const meta = document.querySelector('meta[name="visual-search-enabled"]');
  const enabled = !!(meta && meta.getAttribute('content') === 'true');
  window.__visualSearchEnabled = enabled;
  try {
    Object.defineProperty(require('../fixtures/data'), 'visualSearchEnabled', {
      value: enabled,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn('[visual-search] failed to install visualSearchEnabled on fixtures/data', err);
  }
})();

require('./middleware/initial-render')(page);

// Client routes
require('./routes/home')(page);
require('./routes/static-pages')(page);
require('./routes/search')(page);
require('./routes/object')(page);
require('./routes/person')(page);
require('./routes/group')(page);
require('./routes/document')(page);
require('./routes/museums')(page);
require('./routes/api')(page);
require('./routes/iiif')(page);
require('./routes/embed')(page);
require('./routes/scan')(page);

// Anniversary widget analytics tracking
require('./lib/anniversary-tracking')();

// Post-route middleware for all pages
require('./middleware/error-404')(page);
// do not decode the url received by page.js
// avoid values with & to be split
page({ decodeURLComponents: false });
