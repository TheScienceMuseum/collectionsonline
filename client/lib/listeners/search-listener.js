/**
* Add event listener to the searchbox
*/
const page = require('page');

const loadingBar = require('../loading-bar');
const paramify = require('../../../lib/helpers/paramify.js');
const querify = require('../../../lib/helpers/querify.js');

const keyCategories = require('../../../fixtures/key-categories.js');

module.exports = function () {
  const searchBoxEl = document.getElementById('searchbox');
  searchBoxEl.addEventListener('submit', function (e) {
    loadingBar.start();
    e.preventDefault();
    const searchValue = document.querySelector('.searchbox__search').value;
    const categoryFilter = document.querySelector('.searchbox__category__filter') && document.querySelector('.searchbox__category__filter').value;
    const collectionFilter = document.querySelector('.searchbox__collection__filter') && document.querySelector('.searchbox__collection__filter').value;
    const museumFilter = document.querySelector('.searchbox__museum__filter') && document.querySelector('.searchbox__museum__filter').value;
    const galleryFilter = document.querySelector('.searchbox__gallery__filter') && document.querySelector('.searchbox__gallery__filter').value;
    const archiveFilter = document.querySelector('.searchbox__archive__filter') && document.querySelector('.searchbox__archive__filter').value;
    const hasImageFilter = document.querySelector('.searchbox__hasImage__filter') && document.querySelector('.searchbox__hasImage__filter').value;
    const imageLicenseFilter = document.querySelector('.searchbox__imageLicense__filter') && document.querySelector('.searchbox__imageLicense__filter').value;
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
      const lq = qs.q.toLowerCase();
      let qMatch;

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

    const params = paramify(qs);
    const query = querify(qs);

    const url = '/search' + params + query;
    page.show(url.split(' ').join('-'));
  });
};
