const Fs = require('fs');
const Handlebars = require('handlebars');

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
  'global/internal-header',
  Fs.readFileSync('./templates/partials/global/internal-header.html', 'utf8')
);

Handlebars.registerPartial(
  'global/logo-panel',
  Fs.readFileSync('./templates/partials/global/logo-panel.html', 'utf8')
);

Handlebars.registerPartial(
  'global/menu',
  Fs.readFileSync('./templates/partials/global/menu.html', 'utf8')
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
  Fs.readFileSync(
    './templates/partials/records/record-description.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-related-people',
  Fs.readFileSync(
    './templates/partials/records/record-related-people.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-related-organisations',
  Fs.readFileSync(
    './templates/partials/records/record-related-organisations.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-details',
  Fs.readFileSync('./templates/partials/records/record-details.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-related-objects',
  Fs.readFileSync(
    './templates/partials/records/record-related-objects.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-mph-records',
  Fs.readFileSync(
    './templates/partials/records/record-mph-records.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-sph-records',
  Fs.readFileSync(
    './templates/partials/records/record-sph-records.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-sph-item',
  Fs.readFileSync('./templates/partials/records/record-sph-item.html', 'utf8')
);

Handlebars.registerPartial(
  'records/panel-cite',
  Fs.readFileSync('./templates/partials/records/panel-cite.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-imgpanel__controlbar',
  Fs.readFileSync(
    './templates/partials/records/record-imgpanel__controlbar.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-related-documents',
  Fs.readFileSync(
    './templates/partials/records/record-related-documents.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-related-documents-primary',
  Fs.readFileSync(
    './templates/partials/records/record-related-documents-primary.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-related-articles',
  Fs.readFileSync(
    './templates/partials/records/record-related-articles.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/archive-tree',
  Fs.readFileSync('./templates/partials/records/archive-tree.html', 'utf8')
);

Handlebars.registerPartial(
  'records/archive-tree-browser',
  Fs.readFileSync(
    './templates/partials/records/archive-tree-browser.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/archive-tree-children',
  Fs.readFileSync(
    './templates/partials/records/archive-tree-children.html',
    'utf8'
  )
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

Handlebars.registerPartial(
  'records/mediaplayer',
  Fs.readFileSync('./templates/partials/records/mediaplayer.html', 'utf8')
);

Handlebars.registerPartial(
  'records/audioplayer',
  Fs.readFileSync('./templates/partials/records/audioplayer.html', 'utf8')
);

Handlebars.registerPartial(
  'records/mediaplayer__listitem',
  Fs.readFileSync(
    './templates/partials/records/mediaplayer__listitem.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'global/smg-map',
  Fs.readFileSync('./templates/partials/global/smg-map.html', 'utf8')
);

Handlebars.registerPartial(
  'search/filters-group',
  Fs.readFileSync('./templates/partials/search/filters-group.html', 'utf8')
);
Handlebars.registerPartial(
  'records/record-mgroup-records',
  Fs.readFileSync(
    './templates/partials/records/record-mgroup-records.html',
    'utf8'
  )
);
Handlebars.registerPartial(
  'records/record-related-groups',
  Fs.readFileSync(
    './templates/partials/records/record-related-groups.html',
    'utf8'
  )
);
Handlebars.registerPartial(
  'records/collage',
  Fs.readFileSync('./templates/partials/records/collage.html', 'utf8')
);

// Helpers
Handlebars.registerHelper(
  'classname',
  require('../templates/helpers/classname.js')
);

Handlebars.registerHelper('ifpage', require('../templates/helpers/ifpage.js'));

Handlebars.registerHelper(
  'isselected',
  require('../templates/helpers/isselected.js')
);

Handlebars.registerHelper(
  'getinventorynumber',
  require('../templates/helpers/getinventorynumber.js')
);

Handlebars.registerHelper(
  'geturlsafeinventorynumber',
  require('../templates/helpers/geturlsafeinventorynumber.js')
);

Handlebars.registerHelper(
  'gettodaysdate',
  require('../templates/helpers/gettodaysdate.js')
);

Handlebars.registerHelper(
  'ifmultiple',
  require('../templates/helpers/ifmultiple.js')
);

Handlebars.registerHelper(
  'current',
  require('../templates/helpers/current.js')
);

Handlebars.registerHelper(
  'getlink',
  require('../templates/helpers/getlink.js')
);

Handlebars.registerHelper(
  'displayFilters',
  require('../templates/helpers/displayFilters.js')
);

Handlebars.registerHelper(
  'ifsmgrights',
  require('../templates/helpers/ifsmgrights.js')
);

Handlebars.registerHelper(
  'ifsmgorccrights',
  require('../templates/helpers/ifsmgorccrights.js')
);

Handlebars.registerHelper(
  'taxonomy',
  require('../templates/helpers/taxonomy.js')
);

Handlebars.registerHelper(
  'activeFacet',
  require('../templates/helpers/activeFacet.js')
);

Handlebars.registerHelper('comma', require('../templates/helpers/comma.js'));

Handlebars.registerHelper(
  'filtersSelected',
  require('../templates/helpers/filtersSelected.js')
);

Handlebars.registerHelper(
  'clearAllFilters',
  require('../templates/helpers/clearAllFilters.js')
);

Handlebars.registerHelper(
  'formatrelated',
  require('../templates/helpers/formatrelated.js')
);

Handlebars.registerHelper(
  'seemore',
  require('../templates/helpers/seemore.js')
);

Handlebars.registerHelper(
  'normalise',
  require('../templates/helpers/normalise.js')
);

Handlebars.registerHelper(
  'truncate',
  require('../templates/helpers/truncate.js')
);

Handlebars.registerHelper(
  'truncateDescription',
  require('../templates/helpers/truncateDescription.js')
);

Handlebars.registerHelper('or', require('../templates/helpers/or.js'));

Handlebars.registerHelper(
  'isequal',
  require('../templates/helpers/isequal.js')
);

Handlebars.registerHelper(
  'formatnumber',
  require('../templates/helpers/formatnumber.js')
);

Handlebars.registerHelper(
  'toggleDetail',
  require('../templates/helpers/toggleDetail.js')
);

Handlebars.registerHelper(
  'toggleDetailOpen',
  require('../templates/helpers/toggleDetailOpen.js')
);

Handlebars.registerHelper(
  'isResourcePage',
  require('../templates/helpers/isResourcePage.js')
);
Handlebars.registerHelper('concat', require('../templates/helpers/concat.js'));

Handlebars.registerHelper(
  'ifcreator',
  require('../templates/helpers/ifcreator.js')
);

Handlebars.registerHelper(
  'determineGrouping',
  require('../templates/helpers/determineGrouping.js')
);

Handlebars.registerHelper(
  'firstImage',
  require('../templates/helpers/firstImage.js')
);

Handlebars.registerHelper(
  'haschildimages',
  require('../templates/helpers/haschildimages.js')
);

Handlebars.registerHelper(
  'mphShowMore',
  require('../templates/helpers/mphShowMore.js')
);

Handlebars.registerHelper(
  'notInProd',
  require('../templates/helpers/notInProd')
);
Handlebars.registerHelper('dedupe', require('../templates/helpers/dedupe'));

Handlebars.registerHelper(
  'sphDescription',
  require('../templates/helpers/sphDescription')
);
Handlebars.registerHelper(
  'sphPrioritised',
  require('../templates/helpers/sphPrioritised')
);
Handlebars.registerHelper(
  'groupState',
  require('../templates/helpers/groupState.js')
);
Handlebars.registerHelper(
  'formatCopyright',
  require('../templates/helpers/formatCopyright.js')
);
Handlebars.registerHelper(
  'wikiInfoTransform',
  require('../templates/helpers/wikiInfoTransform.js')
);
Handlebars.registerHelper(
  'isArray',
  require('../templates/helpers/isArray.js')
);

Handlebars.registerHelper(
  'wikidataExcludeField',
  require('../templates/helpers/wikidataExcludeField.js')
);

Handlebars.registerHelper(
  'isWikiLink',
  require('../templates/helpers/isWikiLink.js')
);
Handlebars.registerHelper(
  'getMphCapacity',
  require('../templates/helpers/getMphCapacity.js')
);

Handlebars.registerHelper(
  'isWikiList',
  require('../templates/helpers/isWikiList.js')
);

Handlebars.registerHelper(
  'twoChildRecords',
  require('../templates/helpers/twoChildRecords.js')
);
Handlebars.registerHelper(
  'reverse',
  require('../templates/helpers/reverse.js')
);

Handlebars.registerPartial(
  'records/record-sph-images',
  Fs.readFileSync('./templates/partials/records/record-sph-images.html', 'utf8')
);

Handlebars.registerPartial(
  'records/record-sph-properties',
  Fs.readFileSync(
    './templates/partials/records/record-sph-properties.html',
    'utf8'
  )
);

Handlebars.registerPartial(
  'records/record-sph-priority-item',
  Fs.readFileSync(
    './templates/partials/records/record-sph-priority-item.html',
    'utf8'
  )
);

// Routes
module.exports = {
  404: Handlebars.compile(
    Fs.readFileSync('./templates/pages/404.html', 'utf8')
  ),
  home: Handlebars.compile(
    Fs.readFileSync('./templates/pages/home.html', 'utf8')
  ),
  search: Handlebars.compile(
    Fs.readFileSync('./templates/pages/search.html', 'utf8')
  ),
  'results-grid': Handlebars.compile(
    Fs.readFileSync('./templates/partials/search/results-grid.html', 'utf8')
  ),
  people: Handlebars.compile(
    Fs.readFileSync('./templates/pages/person.html', 'utf8')
  ),
  documents: Handlebars.compile(
    Fs.readFileSync('./templates/pages/archive.html', 'utf8')
  ),
  group: Handlebars.compile(
    Fs.readFileSync('./templates/pages/group.html', 'utf8')
  ),
  objects: Handlebars.compile(
    Fs.readFileSync('./templates/pages/object.html', 'utf8')
  ),
  searchnav: Handlebars.compile(
    Fs.readFileSync('./templates/partials/global/search-nav.html', 'utf8')
  ),
  error: Handlebars.compile(
    Fs.readFileSync('./templates/pages/error.html', 'utf8')
  ),
  rotational: Handlebars.compile(
    Fs.readFileSync('./templates/pages/rotational.html', 'utf8')
  ),
  archiveTree: Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/archive-tree.html', 'utf8')
  ),
  'search-results': Handlebars.compile(
    Fs.readFileSync('./templates/partials/search/results-page.html', 'utf8')
  ),
  'search-main': Handlebars.compile(
    Fs.readFileSync('./templates/partials/global/search-main.html', 'utf8')
  ),
  api: Handlebars.compile(
    Fs.readFileSync('./templates/pages/api.html', 'utf8')
  ),
  articles: Handlebars.compile(
    Fs.readFileSync(
      './templates/partials/records/record-related-articles.html',
      'utf8'
    )
  ),

  wikiInfo: Handlebars.compile(
    Fs.readFileSync('./templates/partials/records/wiki-info.html', 'utf8')
  ),
  about: Handlebars.compile(
    Fs.readFileSync('./templates/pages/about.html', 'utf8')
  ),
  explore: Handlebars.compile(
    Fs.readFileSync('./templates/pages/explore.html', 'utf8')
  )
};
