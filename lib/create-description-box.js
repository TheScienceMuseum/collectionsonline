const categoriesDescription = require('../description-boxes/category.json');
const collectionsDescription = require('../description-boxes/collection.json');
const gallerysDescription = require('../description-boxes/gallery.json');
const museumsDescription = require('../description-boxes/museum.json');
const getPrimaryValue = require('./get-primary-value.js');
const slug = require('slugg');
function createDescriptionBox (
  selectedFilters,
  mphcParent = undefined,
  rootUrl
) {
  selectedFilters = selectedFilters || {};
  function keysToLowerCase (obj) {
    const keys = Object.keys(obj);
    let n = keys.length;
    while (n--) {
      const key = keys[n]; // "cache" it, for less lookups to the array
      if (key !== key.toLowerCase().split('-').join(' ')) {
        // might already be in its lower case version
        obj[key.toLowerCase().split('-').join(' ')] = obj[key]; // swap the value to a new lower case key
        // store the original version as the title if one hasn't been specified
        if (!obj[key.toLowerCase().split('-').join(' ')].title) {
          obj[key.toLowerCase().split('-').join(' ')].title = key;
        }
        delete obj[key]; // delete the old key
      }
    }
    return obj;
  }

  function getDescription (filterKey, jsonDescription) {
    const filter = Object.keys(
      selectedFilters[filterKey] || []
    )[0].toLowerCase();
    const lcDesc = keysToLowerCase(jsonDescription);
    if (lcDesc[filter] && !lcDesc[filter].title) {
      lcDesc[filter].title = filter.toLowerCase();
    }
    return lcDesc[filter];
  }

  function filterNotFoundMessage (filterType, filterKey) {
    // const shouldMatch = Object.keys(selectedFilters[filterKey] || [])[0];
    // console.log(
    //   filterType +
    //     " didn't match, ensure the exact " +
    //     filterType.toLowerCase() +
    //     ' title was used'
    // );
    // console.log(filterKey + ' title should match: ', shouldMatch);
  }

  if (selectedFilters.categories) {
    const categoryDescription = getDescription(
      'categories',
      categoriesDescription
    );
    if (categoryDescription) {
      return { category: categoryDescription };
    }
    filterNotFoundMessage('Category', 'categories');
  }

  if (selectedFilters.collection) {
    const collectionDescription = getDescription(
      'collection',
      collectionsDescription
    );
    if (collectionDescription) {
      return { collection: collectionDescription };
    }
    filterNotFoundMessage('Collection', 'collection');
  }

  if (selectedFilters.gallery) {
    const galleryDescription = getDescription('gallery', gallerysDescription);
    if (galleryDescription) {
      return { gallery: galleryDescription };
    }
    filterNotFoundMessage('Gallery', 'gallery');
  }

  if (selectedFilters.museum) {
    const museumDescription = getDescription('museum', museumsDescription);
    if (museumDescription) {
      return { museum: museumDescription };
    }
    filterNotFoundMessage('Museum', 'museum');
  }

  if (selectedFilters.mphc) {
    if (
      !mphcParent ||
      !mphcParent._source ||
      mphcParent === undefined ||
      !mphcParent._source['@datatype'] ||
      mphcParent._source['@datatype'].grouping !== 'MPH'
    ) {
      return;
    }
    const { description: desc, title } = mphcParent?._source;
    const mphcsDescription = getPrimaryValue(desc) || null;
    const mphcTitle = getPrimaryValue(title) || null;
    const uid = mphcParent._source?.['@admin']?.uid;
    const link = `${rootUrl}/objects/${uid}/${slug(mphcTitle)}`;

    if (mphcsDescription) {
      return {
        mphc: { description: mphcsDescription, title: mphcTitle, link }
      };
    }
    filterNotFoundMessage('mphc', 'mphc');
  }
}

module.exports = createDescriptionBox;
