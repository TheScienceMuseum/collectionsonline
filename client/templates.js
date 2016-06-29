var Fs = require('fs');
var Handlebars = require('handlebars');

// Partials
Handlebars.registerPartial(
  'global/icon',
  Fs.readFileSync('./templates/partials/global/icon.html', 'utf8')
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
  'records/record-related-results',
  Fs.readFileSync('./templates/partials/records/record-related-results.html', 'utf8')
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

// Helpers
Handlebars.registerHelper('unlesspage', require('../templates/helpers/unlesspage.js'));

Handlebars.registerHelper('classname', require('../templates/helpers/classname.js'));

// Routes
module.exports = {
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
  )
};
