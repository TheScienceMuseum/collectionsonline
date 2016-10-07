var page = require('page');

module.exports = () => {
  // 'Search this Archive' Listener
  var archiveSearch = document.querySelector('#archive-search');
  if (archiveSearch) {
    archiveSearch.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = encodeURIComponent(document.getElementById('archive-q').value);
      var archive = encodeURIComponent(document.getElementById('archive-title').value);
      var url = '/search/documents?q=' + q + '&archive=' + archive;
      page.show(url);
    });
  }
};
