var Fs = require('fs');
var Handlebars = require('handlebars');

Handlebars.registerPartial(
  'global/icon',
  Fs.readFileSync('./templates/partials/global/icon.html', 'utf8')
);

module.exports = {
  'results-grid': Handlebars.compile(
    Fs.readFileSync('./templates/partials/search/results-grid.html', 'utf8')
  ),
  'searchnav': Handlebars.compile(
    Fs.readFileSync('./templates/partials/global/search-nav.html', 'utf8')
  )
};
