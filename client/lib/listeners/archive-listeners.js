const page = require('page');
const QueryString = require('querystring');

module.exports = () => {
  // 'Search this Archive' Listener
  const archiveSearch = document.querySelector('#archive-search');
  if (archiveSearch) {
    archiveSearch.addEventListener('submit', function (e) {
      e.preventDefault();
      const q = document.getElementById('archive-q').value;
      const qs = { q };
      const archive = document.getElementById('archive-title').value;
      const url = '/search/documents/archive/' + archive.toLowerCase().split(' ').join('-') + '?' + QueryString.stringify(qs);
      page.show(url);
    });
  }
};
