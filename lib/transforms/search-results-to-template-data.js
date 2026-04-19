const formatNumber = require('format-number')();
const Pagination = require('../pagination');
const getValues = require('./get-values');
const getPrimaryValue = require('../get-primary-value');
const createSelectedFilters = require('./create-selected-filters');
const getNestedProperty = require('../nested-property');
const createClearFacetLinks = require('./create-clear-facet-links');
const pillboxOndisplay = require('../helpers/search-results-to-template-data/pillbox-ondisplay.js');
const pillboxImage = require('../helpers/search-results-to-template-data/pillbox-images.js');
const pillboxMph = require('../helpers/search-results-to-template-data/pillbox-mph.js');
const getTitlePage = require('../helpers/search-results-to-template-data/title-page.js');
const paramify = require('../helpers/paramify');
const querify = require('../helpers/querify');
const createDescriptionBox = require('../create-description-box.js');
const serpDataLayer = require('./serp-data-layer');
const restrictedMaterials = require('../../fixtures/restricted-materials-filters');

const DEFAULT_DESCRIPTION = 'Explore over 500,000 objects and archives from the Science Museum, Science and Industry Museum, National Science and Media Museum, National Railway Museum and Locomotion.';

module.exports = (queryParams, results, config) => {
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const selectedFilters = createSelectedFilters(queryParams);
  // catch and filter out any falsy values and stop from being pulled into filterbadges
  // -createSelectedFilters transforms values into keys from values and can do so with falsy values
  const selectedCategoryFilters = Object.keys(selectedFilters.categories || {});

  const categoryFilters = selectedCategoryFilters.filter(
    (cat) => cat !== 'false' && cat !== 'undefined'
  );

  const selectedCollectionFilters = Object.keys(
    selectedFilters.collection || {}
  );

  const collectionFilters = selectedCollectionFilters.filter(
    (cat) => cat !== 'false' && cat !== 'undefined'
  );

  // transforms uid to more human readable title in filter badge + description box - from separate query as data not available in search results
  const mphcParent = results.mphcParent;
  const mphcFilters = pillboxMph(selectedFilters, mphcParent);
  const museumFilters = pillboxOndisplay(selectedFilters);
  const archiveFilters = Object.keys(selectedFilters.archive || {});
  const imageFilters = pillboxImage(selectedFilters);
  const clearCategoryLink = createClearStickyFilterLink(
    queryParams,
    rootUrl,
    /categories/
  );
  const clearCollectionLink = createClearStickyFilterLink(
    queryParams,
    rootUrl,
    /collection/
  );
  const clearMuseumLink = createClearStickyFilterLink(
    queryParams,
    rootUrl,
    /museum|gallery/
  );
  const clearArchiveLink = createClearStickyFilterLink(
    queryParams,
    rootUrl,
    /archive/
  );

  const clearMphcLink = createClearStickyFilterLink(
    queryParams,
    rootUrl,
    /mphc/
  );
  const clearImageLink = {
    hasImage: createClearStickyFilterLink(queryParams, rootUrl, /has_image/),
    imageLicense: createClearStickyFilterLink(
      queryParams,
      rootUrl,
      /image_license/
    )
  };
  const inProduction = Boolean(results.inProduction);
  const descriptionBox = createDescriptionBox(selectedFilters, mphcParent, rootUrl);
  const titlePage = getTitlePage(queryParams.q, selectedFilters, queryParams.type);

  // Count active content filters (excluding pagination, type, and search)
  const contentFilterKeys = Object.keys(selectedFilters).filter(
    (k) => k !== '' && k !== 'type' && k !== 'search' && k !== 'page[size]' && k !== 'page[type]' && k !== 'page[number]'
  );
  const filterCount = contentFilterKeys.length;
  const pageNumber = queryParams.pageNumber || 0;
  const hasQuery = Boolean(queryParams.q);

  // robots: noindex free-text searches, deep filter combos (4+), and page 2+
  const shouldNoIndex = hasQuery || filterCount >= 4 || pageNumber > 0;
  const robotsMeta = shouldNoIndex ? 'noindex, follow' : 'index, follow';

  // meta description: use description box text if available, else build from filters
  const metaDescription = buildMetaDescription(descriptionBox, titlePage, hasQuery, results.meta, selectedFilters);

  // canonical URL: filter path + type, stripping pagination and free-text query
  const canonicalType = queryParams.type && queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const canonicalUrl = rootUrl + '/search' + canonicalType + paramify(queryParams.query);

  const data = {
    title: 'Search our collection | Science Museum Group Collection',
    titlePage,
    metaDescription,
    robotsMeta,
    ogType: 'website',
    page: results.data.length ? queryParams.pageType : 'noresults',
    q: queryParams.q,
    results: results.data.map(createResult),
    museums: require('../../fixtures/museums'),
    navigation: require('../../fixtures/navigation'),
    pagination: createPagination(queryParams, results, rootUrl),
    filters: results.meta.filters,
    selectedFilters,
    categoryFilters,
    collectionFilters,
    mphcFilters,
    museumFilters,
    archiveFilters,
    imageFilters,
    stickyFilters: categoryFilters
      .concat(collectionFilters)
      .concat(museumFilters)
      .concat(archiveFilters)
      .concat(imageFilters)
      .concat(mphcFilters),
    meta: results.meta,
    links: {
      self: canonicalUrl,
      filterAll: createTypeFilterLink(null, queryParams, rootUrl),
      filterObjects: createTypeFilterLink('objects', queryParams, rootUrl),
      filterPeople: createTypeFilterLink('people', queryParams, rootUrl),
      filterDocuments: createTypeFilterLink('documents', queryParams, rootUrl),
      filterGroup: createTypeFilterLink('group', queryParams, rootUrl),
      clearFilter: createClearFilterLink(queryParams, rootUrl),
      clearFacet: createClearFacetLinks(queryParams, rootUrl),
      grid: createTypePageLink('search', queryParams, rootUrl),
      list: createTypePageLink('results-list', queryParams, rootUrl),
      clearCategoryLink,
      clearCollectionLink,
      clearMuseumLink,
      clearArchiveLink,
      clearImageLink,
      clearMphcLink
    },
    inProduction,
    descriptionBox,
    type: queryParams.type
  };

  // remove restricted materials from filter
  // Added Dec 2025, may want to re-visit / remove in future
  filterRestrictedMaterials(data);

  if (queryParams.type === 'objects') {
    data.isFilterObjects = true;
  } else if (queryParams.type === 'people') {
    data.isFilterPeople = true;
  } else if (queryParams.type === 'documents') {
    data.isFilterDocuments = true;
  } else if (queryParams.type === 'all') {
    data.isFilterAll = true;
  } else if (queryParams.type === 'group') {
    data.isFilterGroup = true;
  }
  if (results.meta.count.type.objects === 0) {
    data.filterObjectsDisabled = true;
  }
  if (results.meta.count.type.people === 0) {
    data.filterPeopleDisabled = true;
  }
  if (results.meta.count.type.documents === 0) {
    data.filterDocumentsDisabled = true;
  }
  if (results.meta.count.type.all === 0) {
    data.filterAllDisabled = true;
  }

  if (results.meta.count.type.group === 0) {
    data.filterGroupDisabled = true;
  }

  data.layer = serpDataLayer(data);
  return data;
};

function filterRestrictedMaterials (data) {
  if (!data?.meta?.filters?.material) {
    // console.warn('No materials data found');
    return data;
  }
  data.meta.filters.material = data.meta.filters.material.filter(item => {
    const isRestricted = restrictedMaterials.includes(item.value);
    return !isRestricted;
  });
}

function createResult (item) {
  return {
    type: item.type,
    title: getValues.getTitle(item),
    category: getCategory(item),
    date: getValues.getDate(item),
    figure: getFigure(item),
    ...(item.type === 'group' ? { collage: getCollageData(item) } : {}),
    figcaption: getFigCaption(item),
    link: item.links && item.links.self,
    occupation: getOccupation(item),
    isOnDisplay: getValues.getDisplayLocation(item),
    level: getValues.getDocumentLevel(item),
    system: getValues.getSystem(item),
    categoryOrArtist: getCategoryOrArtist(item)
  };
}

function getCategoryOrArtist (item) {
  if (
    getCategory(item) === 'Art' ||
    getCategory(item) === 'Contemporary Art Collection'
  ) {
    if (
      getNestedProperty(
        item,
        'attributes.lifecycle.creation.0.maker.0.summary_title'
      )
    ) {
      return getNestedProperty(
        item,
        'attributes.lifecycle.creation.0.maker.0.summary_title'
      );
    }
  }
  return getCategory(item);
}

function getCategory (item) {
  return item.attributes.categories && item.attributes.categories[0].name;
}

function getOccupation (item) {
  return getPrimaryValue(item.attributes.occupation);
}

function getFigure (item, config) {
  const location = getNestedProperty(
    item,
    'attributes.multimedia.0.@processed.large_thumbnail.location'
  );
  return location || null;
}

function getFigCaption (item) {
  let figCaption = '';
  if (item.type === 'objects' || item.type === 'group') {
    figCaption =
      getPrimaryValue(item.attributes.description) ||
      getPrimaryValue(item.attributes.title) ||
      item.attributes.summary_title;
  } else if (item.type === 'people') {
    figCaption = getBriefBiography(item);
  } else if (item.type === 'documents') {
    figCaption =
      getNestedProperty(item, 'attributes.measurements.extent') ||
      getPrimaryValue(
        getNestedProperty(item, 'attributes.measurements.dimensions')
      ) ||
      getPrimaryValue(item.attributes.description) ||
      getPrimaryValue(item.attributes.title);
  }
  return figCaption;
}

function getBriefBiography (item) {
  if (item.attributes.description) {
    const bio = item.attributes.description.find(
      (el) => el.type === 'brief biography'
    );
    return bio
      ? bio.value
      : getPrimaryValue(item.attributes.title) ||
          item.attributes.summary_title ||
          null;
  }
}

function createPagination (queryParams, results, rootUrl) {
  const pageNumber = queryParams.pageNumber;
  const pageSize = queryParams.pageSize;
  const limitNbPage =
    results.meta.total_pages <= 10 ? results.meta.total_pages : 10;

  const pages = Pagination.pages(pageNumber, limitNbPage, {
    createPageLink: (page) => {
      page.pageNumberDisplay = formatNumber(page.pageNumber + 1);
      const pageParams = Object.assign({}, queryParams.query, {
        'page[number]': page.pageNumber
      });
      const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
      return `${rootUrl}/search${type}${paramify(pageParams)}${querify(
        pageParams
      )}`;
    }
  });

  return {
    totalPages: limitNbPage,
    pageNumber: pageNumber + 1,
    isFirst: pageNumber === 0,
    isLast: pageNumber === limitNbPage - 1,
    isPageSize50: pageSize === 50,
    isPageSize100: pageSize === 100,
    links: Object.assign({}, results.links, { pages })
  };
}

function createTypeFilterLink (type, queryParams, rootUrl) {
  const params = queryParams.query;
  if (queryParams.pageSize !== 50) {
    params['page[size]'] = queryParams.pageSize;
  }
  if (queryParams.pageType !== 'search') {
    params['page[type]'] = queryParams.pageType;
  }
  delete params.type;
  type = type ? '/' + type : '';
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function createTypePageLink (pageType, queryParams, rootUrl) {
  const params = queryParams.query;
  if (queryParams.pageSize !== 50) {
    params['page[size]'] = queryParams.pageSize;
  }
  params['page[type]'] = pageType;
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function createClearFilterLink (queryParams, rootUrl) {
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const params = {
    q: queryParams.q,
    'page[size]': queryParams.pageSize
  };
  params['page[type]'] = queryParams.pageType;
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function createClearStickyFilterLink (queryParams, rootUrl, filter) {
  const params = {};
  Object.keys(queryParams.query).forEach(function (qp) {
    if (!qp.match(filter)) {
      params[qp] = queryParams.query[qp];
    }
  });
  if (queryParams.pageSize !== 50) {
    params['page[size]'] = queryParams.pageSize;
  }
  if (queryParams.pageType !== 'search') {
    params['page[type]'] = queryParams.pageType;
  }
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function buildMetaDescription (descriptionBox, titlePage, hasQuery, meta, selectedFilters) {
  // Use description box text from fixtures if available (museum, gallery, category descriptions)
  const boxType = descriptionBox && Object.keys(descriptionBox).find(
    (k) => !['sides', 'boxType'].includes(k) && descriptionBox[k]
  );
  if (boxType && descriptionBox[boxType] && descriptionBox[boxType].description) {
    const desc = descriptionBox[boxType].description;
    return desc.length > 300 ? desc.substring(0, 297) + '...' : desc;
  }

  // Extract filter info for natural descriptions
  let museum = selectedFilters && selectedFilters.museum && Object.keys(selectedFilters.museum)[0];
  const gallery = selectedFilters && selectedFilters.gallery && Object.keys(selectedFilters.gallery)[0];
  const category = selectedFilters && selectedFilters.categories && Object.keys(selectedFilters.categories)[0];

  // Museum rename (mirrors title-page.js)
  if (museum === 'National Media Museum') museum = 'National Science and Media Museum';
  if (museum === 'Museum of Science and Industry') museum = 'Science and Industry Museum';

  const locationSuffix = buildLocationSuffix(museum, gallery);
  // Only use category as subject with location — collection names are too verbose
  const subject = category || null;

  const totalResults = meta && meta.total_results;
  const titlePart = titlePage.replace(/ \| Science Museum Group Collection$/, '');
  const hasFilters = titlePart !== 'Search our collection';

  // With result count
  if (totalResults && !hasQuery) {
    if (locationSuffix) {
      if (subject) {
        return `Browse ${formatNumber(totalResults)} results for ${subject} ${locationSuffix}.`;
      }
      return `Browse ${formatNumber(totalResults)} results ${locationSuffix}.`;
    }
    return `Browse ${formatNumber(totalResults)} results for ${titlePart} in the Science Museum Group Collection.`;
  }

  // Filter pages without result count
  if (hasFilters && !hasQuery) {
    if (locationSuffix) {
      if (subject) {
        return `Explore ${subject} ${locationSuffix}.`;
      }
      return `Explore what's ${locationSuffix}.`;
    }
    return `Explore ${titlePart} in the Science Museum Group Collection.`;
  }

  return DEFAULT_DESCRIPTION;
}

function buildLocationSuffix (museum, gallery) {
  if (museum && gallery) return 'on display in the ' + gallery + ' at the ' + museum;
  if (museum) return 'on display at the ' + museum;
  return null;
}

// builds image grid/collage for Topic curatorial type cards
function getCollageData (item) {
  const childRecords = item.attributes.child || [];
  let images = [];

  const filteredImages = childRecords.filter((child) => child.multimedia);

  // gets the first image off each child record
  const firstImageArray = filteredImages
    .map((child) =>
      getNestedProperty(child, 'multimedia.@processed.large_thumbnail.location')
    )
    .filter((location) => location !== undefined);

  const numImagesRequired = 9;

  // configures based on length of images array, so there's always 9 images
  if (firstImageArray.length >= numImagesRequired) {
    images = firstImageArray.slice(0, numImagesRequired);
  } else if (firstImageArray.length === 1) {
    const singleImage = firstImageArray[0];
    images = Array.from({ length: numImagesRequired }, () => singleImage);
  } else if (
    firstImageArray.length > 1 &&
    firstImageArray.length < numImagesRequired
  ) {
    // repeats images up to 9 images if there are less than 9
    let repeatedImages = [];

    const numTimesRepeat = Math.ceil(
      numImagesRequired / firstImageArray.length
    );

    for (let i = 0; i < numTimesRepeat; i++) {
      repeatedImages = repeatedImages.concat(firstImageArray);
    }
    images = repeatedImages.slice(0, numImagesRequired);
  } else {
    images = null;
  }

  return images;
}
