var page = require('page');
var QueryString = require('querystring');

module.exports = () => {
  // 'Search this Archive' Listener
  var archiveSearch = document.querySelector('#archive-search');
  if (archiveSearch) {
    archiveSearch.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = document.getElementById('archive-q').value;
      var qs = { q };
      var archive = document.getElementById('archive-title').value;
      qs['filter[archive]'] = archive.toLowerCase();
      var url = '/search/documents?' + QueryString.stringify(qs);
      page.show(url);
    });
  }
};
