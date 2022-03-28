const categoriesDescription = require('../description-boxes/category.json');
const collectionsDescription = require('../description-boxes/collection.json');
const gallerysDescription = require('../description-boxes/gallery.json');
const museumsDescription = require('../description-boxes/museum.json');

function createDescriptionBox (selectedFilters) {
  selectedFilters = selectedFilters || {};

  function keysToLowerCase (obj) {
    var keys = Object.keys(obj);
    var n = keys.length;
    while (n--) {
      var key = keys[n]; // "cache" it, for less lookups to the array
      if (key !== key.toLowerCase().split('-').join(' ')) { // might already be in its lower case version
        obj[key.toLowerCase().split('-').join(' ')] = obj[key]; // swap the value to a new lower case key
        // store the original version as the title if one hasn't been specified
        if (!obj[key.toLowerCase().split('-').join(' ')].title) {
          obj[key.toLowerCase().split('-').join(' ')].title = key;
        }
        delete obj[key]; // delete the old key
      }
    }
    return (obj);
  }

  function getDescription (filterKey, jsonDescription) {
    const filter = Object.keys(selectedFilters[filterKey] || [])[0].toLowerCase();
    const lcDesc = keysToLowerCase(jsonDescription);
    if (lcDesc[filter] && !lcDesc[filter].title) {
      lcDesc[filter].title = filter.toLowerCase();
    }
    return lcDesc[filter];
  }

  function filterNotFoundMessage (filterType, filterKey) {
    const shouldMatch = Object.keys(selectedFilters[filterKey] || [])[0];
    console.log(filterType + ' didn\'t match, ensure the exact ' + filterType.toLowerCase() + ' title was used');
    console.log(filterKey + ' title should match: ', shouldMatch);
  }

  if (selectedFilters.categories) {
    const categoryDescription = getDescription('categories', categoriesDescription);
    if (categoryDescription) {
      return {category: categoryDescription};
    }
    filterNotFoundMessage('Category', 'categories');
  }

  if (selectedFilters.collection) {
    const collectionDescription = getDescription('collection', collectionsDescription);
    if (collectionDescription) {
      return {collection: collectionDescription};
    }
    filterNotFoundMessage('Collection', 'collection');
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
