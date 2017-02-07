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
    var galleryFilter = document.querySelector('.searchbox__gallery__filter') && document.querySelector('.searchbox__gallery__filter').value;
    var archiveFilter = document.querySelector('.searchbox__archive__filter') && document.querySelector('.searchbox__archive__filter').value;
    var hasImageFilter = document.querySelector('.searchbox__hasImage__filter') && document.querySelector('.searchbox__hasImage__filter').value;
    var imageLicenseFilter = document.querySelector('.searchbox__imageLicense__filter') && document.querySelector('.searchbox__imageLicense__filter').value;
    const q = searchValue || null;
    const qs = { q };

    if (categoryFilter) {
      qs['filter[categories]'] = categoryFilter;
    }
    if (museumFilter) {
      qs['filter[museum]'] = museumFilter;
    }
    if (galleryFilter) {
      qs['filter[gallery]'] = galleryFilter;
    }
    if (archiveFilter) {
      qs['filter[archive]'] = archiveFilter;
    }
    if (hasImageFilter) {
      qs['filter[has_image]'] = hasImageFilter;
    }
    if (imageLicenseFilter) {
      qs['filter[image_license]'] = imageLicenseFilter;
    }
    var url = '/search?' + QueryString.stringify(qs);
    page.show(url);
  });
};
