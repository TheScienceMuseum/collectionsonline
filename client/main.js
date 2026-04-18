require('./lib/polyfills.js')();
const page = require('page');

// Warm up the AWS WAF token cookie before any AJAX fires. The SDK's
// challenge.js is loaded deferred from the default layout; calling getToken()
// here asks it to issue/refresh the token immediately so fast first-AJAX
// interactions (e.g. search-box autocomplete) don't race the SDK init.
if (typeof window !== 'undefined' && window.AwsWafIntegration && typeof window.AwsWafIntegration.getToken === 'function') {
  window.AwsWafIntegration.getToken().catch(() => {});
}

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

// Anniversary widget analytics tracking
require('./lib/anniversary-tracking')();

// Post-route middleware for all pages
require('./middleware/error-404')(page);
// do not decode the url received by page.js
// avoid values with & to be split
page({ decodeURLComponents: false });
