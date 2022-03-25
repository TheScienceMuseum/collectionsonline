/**
* Add event listener to the searchbox
*/
var page = require('page');

var loadingBar = require('../loading-bar');
var paramify = require('../../../lib/helpers/paramify.js');
var querify = require('../../../lib/helpers/querify.js');

var keyCategories = require('../../../fixtures/key-categories.js');

module.exports = function () {
  var searchBoxEl = document.getElementById('searchbox');
  searchBoxEl.addEventListener('submit', function (e) {
    loadingBar.start();
    e.preventDefault();
    var searchValue = document.querySelector('.searchbox__search').value;
    var categoryFilter = document.querySelector('.searchbox__category__filter') && document.querySelector('.searchbox__category__filter').value;
    var collectionFilter = document.querySelector('.searchbox__collection__filter') && document.querySelector('.searchbox__collection__filter').value;
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
    if (collectionFilter) {
      qs['filter[collection]'] = collectionFilter;
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

    if (!qs['filter[categories]'] && qs.q) {
      var lq = qs.q.toLowerCase();
      var qMatch;

      if (keyCategories.some(el => {
        if (el.category === lq || el.synonyms.indexOf(lq) > -1) {
          qMatch = el.category;
          return true;
        } else {
          return false;
        }
      })) {
        qs['filter[categories]'] = qMatch;
        qs.q = '';
      }
    }

    var params = paramify(qs);
    var query = querify(qs);

    var url = '/search' + params + query;
    page.show(url.split(' ').join('-'));
  });
};
