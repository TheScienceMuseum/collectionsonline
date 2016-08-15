var Fs = require('fs');
var Handlebars = require('handlebars');

// Partials
Handlebars.registerPartial(
  'global/icon',
  Fs.readFileSync('./templates/partials/global/icon.html', 'utf8')
);

Handlebars.registerPartial(
  'global/search-nav',
  Fs.readFileSync('./templates/partials/global/search-nav.html', 'utf8')
);

Handlebars.registerPartial(
  'global/search-main',
  Fs.readFileSync('./templates/partials/global/search-main.html', 'utf8')
);

Handlebars.registerPartial(
  'global/searchbox',
  Fs.readFileSync('./templates/partials/global/searchbox.html', 'utf8')
);

Handlebars.registerPartial(
  'global/global-header',
  Fs.readFileSync('./templates/partials/global/global-header.html', 'utf8')
);

Handlebars.registerPartial(
  'global/global-footer',
  Fs.readFileSync('./templates/partials/global/global-footer.html', 'utf8')
);

Handlebars.registerPartial(
  'global/footer-banner',
  Fs.readFileSync('./templates/partials/global/footer-banner.html', 'utf8')
);

Handlebars.registerPartial(
  'search/results-page',
  Fs.readFileSync('./templates/partials/search/results-page.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters-people',
  Fs.readFileSync('./templates/partials/search/filters-people.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters-objects',
  Fs.readFileSync('./templates/partials/search/filters-objects.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters-all',
  Fs.readFileSync('./templates/partials/search/filters-all.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters-documents',
  Fs.readFileSync('./templates/partials/search/filters-documents.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters',
  Fs.readFileSync('./templates/partials/search/filters.html', 'utf8')
);

Handlebars.registerPartial(
  'search/pagination',
  Fs.readFileSync('./templates/partials/search/pagination.html', 'utf8')
);

Handlebars.registerPartial(
  'search/results-grid',
  Fs.readFileSync('./templates/partials/search/results-grid.html', 'utf8')
);

Handlebars.registerPartial(
  'search/results-list',
  Fs.readFileSync('./templates/partials/search/results-list.html', 'utf8')
);

Handlebars.registerPartial(
  'search/noresults',
  Fs.readFileSync('./templates/partials/search/noresults.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-top',
  Fs.readFileSync('./templates/partials/records/record-top.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-description',
  Fs.readFileSync('./templates/partials/records/record-description.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-people',
  Fs.readFileSync('./templates/partials/records/record-related-people.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-organisations',
  Fs.readFileSync('./templates/partials/records/record-related-organisations.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-details',
  Fs.readFileSync('./templates/partials/records/record-details.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-objects',
  Fs.readFileSync('./templates/partials/records/record-related-objects.html', 'utf8')
);

Handlebars.registerPartial(
  'records/panel-taxonomy',
  Fs.readFileSync('./templates/partials/records/panel-taxonomy.html', 'utf8')
);

Handlebars.registerPartial(
  'records/panel-cite',
  Fs.readFileSync('./templates/partials/records/panel-cite.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-imgpanel__controlbar',
  Fs.readFileSync('./templates/partials/records/record-imgpanel__controlbar.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-documents',
  Fs.readFileSync('./templates/partials/records/record-related-documents.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree',
  Fs.readFileSync('./templates/partials/records/archive-tree.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree-fond',
  Fs.readFileSync('./templates/partials/records/archive-tree-fond.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree-nest',
  Fs.readFileSync('./templates/partials/records/archive-tree-nest.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree-children',
  Fs.readFileSync('./templates/partials/records/archive-tree-children.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-system',
  Fs.readFileSync('./templates/partials/records/record-system.html', 'utf8')
);

Handlebars.registerPartial(
  'records/ondisplay',
  Fs.readFileSync('./templates/partials/records/ondisplay.html', 'utf8')
);

// Helpers
Handlebars.registerHelper('classname', require('../templates/helpers/classname.js'));

Handlebars.registerHelper('ifpage', require('../templates/helpers/ifpage.js'));

Handlebars.registerHelper('isselected', require('../templates/helpers/isselected.js'));

Handlebars.registerHelper('getinventorynumber', require('../templates/helpers/getinventorynumber.js'));

Handlebars.registerHelper('gettodaysdate', require('../templates/helpers/gettodaysdate.js'));

Handlebars.registerHelper('ifmultiplepages', require('../templates/helpers/ifmultiplepages.js'));

Handlebars.registerHelper('isfond', require('../templates/helpers/isfond.js'));

Handlebars.registerHelper('parentid', require('../templates/helpers/parentid.js'));

// Routes
module.exports = {
  'home': Handlebars.compile(
    Fs.readFileSync('./templates/pages/home.html', 'utf8')
  ),
  'search': Handlebars.compile(
    Fs.readFileSync('./templates/pages/search.html', 'utf8')
  ),
  'results-grid': Handlebars.compile(
    Fs.readFileSync('./templates/partials/search/results-grid.html', 'utf8')
  ),
  'people': Handlebars.compile(
    Fs.readFileSync('./templates/pages/person.html', 'utf8')
  ),
  'documents': Handlebars.compile(
    Fs.readFileSync('./templates/pages/archive.html', 'utf8')
  ),
  'objects': Handlebars.compile(
    Fs.readFileSync('./templates/pages/object.html', 'utf8')
  ),
  'searchnav': Handlebars.compile(
    Fs.readFileSync('./templates/partials/global/search-nav.html', 'utf8')
  ),
  'error': Handlebars.compile(
    Fs.readFileSync('./templates/pages/error.html', 'utf8')
  ),
  'archiveTree': Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/archive-tree.html', 'utf8')
  )
};
