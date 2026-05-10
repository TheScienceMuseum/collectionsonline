require('./lib/polyfills.js')();
const page = require('page');

// Pick up the visual-search feature flag from the server's initial
// render (gated meta tag in templates/layouts/default.html). Stashing
// it on window early means SPA-rendered pages can read it via the
// fixtures/data.js getter — without that, the camera entry-point in
// the searchbox disappears the moment the user clicks any link.
(function () {
  const meta = document.querySelector('meta[name="visual-search-enabled"]');
  window.__visualSearchEnabled = !!(meta && meta.getAttribute('content') === 'true');
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
