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
  'records/record-related-documents-primary',
  Fs.readFileSync('./templates/partials/records/record-related-documents-primary.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-articles',
  Fs.readFileSync('./templates/partials/records/record-related-articles.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree',
  Fs.readFileSync('./templates/partials/records/archive-tree.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree-browser',
  Fs.readFileSync('./templates/partials/records/archive-tree-browser.html', 'utf8')
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

Handlebars.registerPartial(
  'records/carousel',
  Fs.readFileSync('./templates/partials/records/carousel.html', 'utf8')
);

Handlebars.registerPartial(
  'records/single-image',
  Fs.readFileSync('./templates/partials/records/single-image.html', 'utf8')
);

// Helpers
Handlebars.registerHelper('classname', require('../templates/helpers/classname.js'));

Handlebars.registerHelper('ifpage', require('../templates/helpers/ifpage.js'));

Handlebars.registerHelper('isselected', require('../templates/helpers/isselected.js'));

Handlebars.registerHelper('getinventorynumber', require('../templates/helpers/getinventorynumber.js'));

Handlebars.registerHelper('geturlsafeinventorynumber', require('../templates/helpers/geturlsafeinventorynumber.js'));

Handlebars.registerHelper('gettodaysdate', require('../templates/helpers/gettodaysdate.js'));

Handlebars.registerHelper('ifmultiple', require('../templates/helpers/ifmultiple.js'));

Handlebars.registerHelper('current', require('../templates/helpers/current.js'));

Handlebars.registerHelper('getlink', require('../templates/helpers/getlink.js'));

Handlebars.registerHelper('displayFilters', require('../templates/helpers/displayFilters.js'));

Handlebars.registerHelper('ifsmgrights', require('../templates/helpers/ifsmgrights.js'));

Handlebars.registerHelper('ifsmgorccrights', require('../templates/helpers/ifsmgorccrights.js'));

Handlebars.registerHelper('taxonomy', require('../templates/helpers/taxonomy.js'));

Handlebars.registerHelper('activeFacet', require('../templates/helpers/activeFacet.js'));

Handlebars.registerHelper('comma', require('../templates/helpers/comma.js'));

Handlebars.registerHelper('filtersSelected', require('../templates/helpers/filtersSelected.js'));

Handlebars.registerHelper('clearAllFilters', require('../templates/helpers/clearAllFilters.js'));

Handlebars.registerHelper('formatrelated', require('../templates/helpers/formatrelated.js'));

Handlebars.registerHelper('seemore', require('../templates/helpers/seemore.js'));

Handlebars.registerHelper('normalise', require('../templates/helpers/normalise.js'));

Handlebars.registerHelper('truncate', require('../templates/helpers/truncate.js'));

Handlebars.registerHelper('or', require('../templates/helpers/or.js'));

Handlebars.registerHelper('isequal', require('../templates/helpers/isequal.js'));

Handlebars.registerHelper('formatnumber', require('../templates/helpers/formatnumber.js'));

Handlebars.registerHelper('toggleDetail', require('../templates/helpers/toggleDetail.js'));

Handlebars.registerHelper('isResourcePage', require('../templates/helpers/isResourcePage.js'));

// Routes
module.exports = {
  '404': Handlebars.compile(
    Fs.readFileSync('./templates/pages/404.html', 'utf8')
  ),
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
  ),
  'search-results': Handlebars.compile(
    Fs.readFileSync('./templates/partials/search/results-page.html', 'utf8')
  ),
  'search-main': Handlebars.compile(
    Fs.readFileSync('./templates/partials/global/search-main.html', 'utf8')
  ),
  'api': Handlebars.compile(
    Fs.readFileSync('./templates/pages/api.html', 'utf8')
  ),
  'articles': Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/record-related-articles.html', 'utf8')
  ),
  'wikiImage': Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/wiki-image.html', 'utf8')
  ),
  'wikiInfo': Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/wiki-info.html', 'utf8')
  ),
  'wikiSummary': Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/wiki-summary.html', 'utf8')
  )
};
