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

module.exports = (queryParams, results, config) => {
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const selectedFilters = createSelectedFilters(queryParams);

  const categoryFilters = Object.keys(selectedFilters.categories || {});
  const collectionFilters = Object.keys(selectedFilters.collection || {});
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

  const data = {
    title: 'Search our collection | Science Museum Group Collection',
    titlePage: getTitlePage(queryParams.q, selectedFilters),
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
    descriptionBox: createDescriptionBox(selectedFilters, mphcParent, rootUrl),
    type: queryParams.type
  };

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

function createResult (item) {
  return {
    type: item.type,
    title: getValues.getTitle(item),
    category: getCategory(item),
    date: getValues.getDate(item),
    figure: getFigure(item),
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
