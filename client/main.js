var $ = window.$ = window.jQuery = require('jquery');

require('foundation-sites');

// loads foundation base (responsive media queries etc.
$(document).foundation();

var page = require('page');

// Pre-route middleware for all pages
require('./middleware/initial-render')(page);

// Client routes
require('./routes/home')(page);
require('./routes/search')(page);
require('./routes/object')(page);
require('./routes/person')(page);
require('./routes/document')(page);

// Post-route middleware for all pages
require('./middleware/error-404')(page);

page();
