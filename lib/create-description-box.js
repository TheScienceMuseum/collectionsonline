const lowerKeys = require('lowercase-keys-object');
const categoriesDescription = require('../description-boxes/category.json');
const categoriesDescriptionLC = lowerKeys(categoriesDescription);
const gallerysDescription = require('../description-boxes/gallery.json');
const museumsDescription = require('../description-boxes/museum.json');

function createDescriptionBox (selectedFilters) {
  selectedFilters = selectedFilters || {};

  function getDescription (filterKey, jsonDescription) {
    const filter = Object.keys(selectedFilters[filterKey] || [])[0];
    if (jsonDescription[filter.toLowerCase()] && !jsonDescription[filter.toLowerCase()].title) {
      jsonDescription[filter.toLowerCase()].title = filter;
    }
    return jsonDescription[filter.toLowerCase()];
  }

  function filterNotFoundMessage (filterType, filterKey) {
    const shouldMatch = Object.keys(selectedFilters[filterKey] || [])[0];
    console.log(filterType + ' didn\'t match, ensure the exact ' +
      filterType.toLowerCase() + ' title was used');
    console.log(filterKey + ' title should match: ', shouldMatch);
  }

  if (selectedFilters.categories) {
    const categoryDescription = getDescription('categories', categoriesDescriptionLC);
    if (categoryDescription) {
      return {category: categoryDescription};
    }
    filterNotFoundMessage('Category', 'categories');
  }

  if (selectedFilters.gallery) {
    const galleryDescription = getDescription('gallery', gallerysDescription);
    if (galleryDescription) {
      return {gallery: galleryDescription};
    }
    filterNotFoundMessage('Gallery', 'gallery');
  }

  if (selectedFilters.museum) {
    const museumDescription = getDescription('museum', museumsDescription);
    if (museumDescription) {
      return {museum: museumDescription};
    }
    filterNotFoundMessage('Museum', 'museum');
  }
}

module.exports = createDescriptionBox;
