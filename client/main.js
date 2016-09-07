var page = require('page');

require('./middleware/initial-render')(page);

// define the state of the filter pannel, open or not
require('./middleware/filter-state')(page);
// Client routes
require('./routes/home')(page);
require('./routes/search')(page);
require('./routes/object')(page);
require('./routes/person')(page);
require('./routes/document')(page);

// Post-route middleware for all pages
require('./middleware/error-404')(page);
// do not decode the url received by page.js
// avoid values with & to be split
page({decodeURLComponents: false});
