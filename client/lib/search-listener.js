/**
* Add event listener to the searchbox
*/
var QueryString = require('querystring');
var page = require('page');
var loadingBar = require('./loading-bar');

module.exports = function () {
  var searchBoxEl = document.getElementById('searchbox');
  searchBoxEl.addEventListener('submit', function (e) {
    loadingBar.start();
    e.preventDefault();
    var searchValue = document.querySelector('.searchbox__search').value;
    var categoryFilter = document.querySelector('.searchbox__category__filter') && document.querySelector('.searchbox__category__filter').value;
    var museumFilter = document.querySelector('.searchbox__museum__filter') && document.querySelector('.searchbox__museum__filter').value;
    var archiveFilter = document.querySelector('.searchbox__archive__filter') && document.querySelector('.searchbox__archive__filter').value;
    const q = searchValue || null;
    const qs = { q };
    if (categoryFilter) {
      qs['filter[categories]'] = categoryFilter;
    }
    if (museumFilter) {
      qs['filter[museum]'] = museumFilter;
    }
    if (archiveFilter) {
      qs['filter[archive]'] = archiveFilter;
    }
    var url = '/search?' + QueryString.stringify(qs);
    page.show(url);
  });
};
