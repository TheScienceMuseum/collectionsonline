const categoriesDescription = require('../description-boxes/category.json');
const collectionsDescription = require('../description-boxes/collection.json');
const gallerysDescription = require('../description-boxes/gallery.json');
const museumsDescription = require('../description-boxes/museum.json');
const mgroupsDescription = require('../description-boxes/mgroup.json');
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

  function returnBox (descriptionBox) {
    const boxType = Object.keys(descriptionBox)[0];
    if(!descriptionBox[boxType]) return false;
    const layoutAttributes = {
      sides: 0,
      boxType
    };
    Object.keys(descriptionBox[boxType]).forEach((key) => {
      if (['sub-categories','related-articles','link-to-gallery-page','thumbnail'].includes(key)) {
        layoutAttributes.sides += 1;
      }
    });
    return { ...descriptionBox, ...layoutAttributes };
  }

  if (selectedFilters.categories) {
    return returnBox({ category: getDescription('categories', categoriesDescription) });
  }

  if (selectedFilters.collection) {
      return returnBox({ collection: getDescription('collection', collectionsDescription) });
  }

  if (selectedFilters.gallery) {
    return returnBox({ gallery: getDescription('gallery', gallerysDescription) });
  }

  if (selectedFilters.museum) {
    return returnBox({ museum: getDescription('museum', museumsDescription) });
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
      return returnBox({
        mphc: { description: mphcsDescription, title: mphcTitle, link }
      });
    }
  }

  if(selectedFilters.type?.group && !selectedFilters.subgroup) {
    const exploreDescription = mgroupsDescription.Explore;
    return returnBox({ explore: exploreDescription });
  }
}

module.exports = createDescriptionBox;
