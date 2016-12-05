const QueryString = require('querystring');
const formatNumber = require('format-number')();
const Pagination = require('../pagination');
const getValues = require('./get-values');
const getPrimaryValue = require('../get-primary-value');
const createSelectedFilters = require('./create-selected-filters');
const getNestedProperty = require('../nested-property');
const createClearFacetLinks = require('./create-clear-facet-links');
const pillboxOndisplay = require('../helpers/search-results-to-template-data/pillbox-ondisplay.js');
const truncate = require('../helpers/search-results-to-template-data/truncate');

module.exports = (queryParams, results, config) => {
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const selectedFilters = createSelectedFilters(queryParams);
  const categoryFilters = Object.keys(selectedFilters.categories || {});
  const museumFilters = pillboxOndisplay(selectedFilters);
  const archiveFilters = Object.keys(selectedFilters.archive || {});
  const clearCategoryLink = createClearStickyFilterLink(queryParams, rootUrl, /categories/);
  const clearMuseumLink = createClearStickyFilterLink(queryParams, rootUrl, /museum|gallery/);
  const clearArchiveLink = createClearStickyFilterLink(queryParams, rootUrl, /archive/);
  const inProduction = Boolean(results.inProduction);
  const data = {
    title: 'Search our collection | Science Museum Group Collection',
    titlePage: 'Search our collection | Science Museum Group Collection',
    page: results.data.length ? queryParams.pageType : 'noresults',
    q: queryParams.q,
    results: results.data.map(createResult),
    footer: require('../../fixtures/footer'),
    footerBanner: require('../../fixtures/footer-banner'),
    pagination: createPagination(queryParams, results, rootUrl),
    filters: results.meta.filters,
    selectedFilters: selectedFilters,
    categoryFilters: categoryFilters,
    museumFilters: museumFilters,
    archiveFilters: archiveFilters,
    stickyFilters: categoryFilters.concat(museumFilters).concat(archiveFilters),
    meta: results.meta,
    links: {
      filterAll: createTypeFilterLink(null, queryParams, rootUrl),
      filterObjects: createTypeFilterLink('objects', queryParams, rootUrl),
      filterPeople: createTypeFilterLink('people', queryParams, rootUrl),
      filterDocuments: createTypeFilterLink('documents', queryParams, rootUrl),
      clearFilter: createClearFilterLink(queryParams, rootUrl),
      clearFacet: createClearFacetLinks(queryParams, rootUrl),
      grid: createTypePageLink('search', queryParams, rootUrl),
      list: createTypePageLink('results-list', queryParams, rootUrl),
      clearCategoryLink: clearCategoryLink,
      clearMuseumLink: clearMuseumLink,
      clearArchiveLink: clearArchiveLink
    },
    inProduction: inProduction
  };

  if (queryParams.type === 'objects') {
    data.isFilterObjects = true;
  } else if (queryParams.type === 'people') {
    data.isFilterPeople = true;
  } else if (queryParams.type === 'documents') {
    data.isFilterDocuments = true;
  } else if (queryParams.type === 'all') {
    data.isFilterAll = true;
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
    system: getValues.getSystem(item)
  };
}

function getCategory (item) {
  return item.attributes.categories && item.attributes.categories[0].name;
}

function getOccupation (item) {
  return getPrimaryValue(item.attributes.occupation);
}

function getFigure (item, config) {
  var location = getNestedProperty(item, 'attributes.multimedia.0.processed.large_thumbnail.location');
  return location || null;
}

function getFigCaption (item) {
  var figCaption = '';
  if (item.type === 'objects') {
    figCaption = getPrimaryValue(item.attributes.description) || getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
  } else if (item.type === 'people') {
    figCaption = getBriefBiography(item);
  } else if (item.type === 'documents') {
    figCaption = getPrimaryValue(getNestedProperty(item, 'attributes.measurements.dimensions')) || getPrimaryValue(item.attributes.description) || getPrimaryValue(item.attributes.title);
  }
  return truncate(figCaption, 42);
}

function getBriefBiography (item) {
  if (item.attributes.description) {
    const bio = item.attributes.description.find((el) => el.type === 'brief biography');
    return bio ? bio.value : getPrimaryValue(item.attributes.title) || item.attributes.summary_title || null;
  }
}

function createPagination (queryParams, results, rootUrl) {
  const pageNumber = queryParams.pageNumber;
  const pageSize = queryParams.pageSize;

  const pages = Pagination.pages(
    pageNumber,
    results.meta.total_pages,
    {
      createPageLink: (page) => {
        page.pageNumberDisplay = formatNumber(page.pageNumber + 1);
        const pageParams = Object.assign({}, queryParams.query, { 'page[number]': page.pageNumber });
        const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
        return `${rootUrl}/search${type}?${QueryString.stringify(pageParams)}`;
      }
    }
  );

  return {
    totalPages: results.meta.total_pages,
    pageNumber: pageNumber + 1,
    isFirst: pageNumber === 0,
    isLast: pageNumber === results.meta.total_pages - 1,
    isPageSize50: pageSize === 50,
    isPageSize100: pageSize === 100,
    links: Object.assign({}, results.links, { pages })
  };
}

function createTypeFilterLink (type, queryParams, rootUrl) {
  const params = queryParams.query;
  params['page[size]'] = queryParams.pageSize;
  params['page[type]'] = queryParams.pageType;
  type = type ? '/' + type : '';
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

function createTypePageLink (pageType, queryParams, rootUrl) {
  const params = queryParams.query;
  params['page[size]'] = queryParams.pageSize;
  params['page[type]'] = pageType;
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

function createClearFilterLink (queryParams, rootUrl) {
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const params = {
    q: queryParams.q,
    'page[size]': queryParams.pageSize
  };
  params['page[type]'] = queryParams.pageType;
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

function createClearStickyFilterLink (queryParams, rootUrl, filter) {
  const params = {};
  Object.keys(queryParams.query).forEach(function (qp) {
    if (!qp.match(filter)) {
      params[qp] = queryParams.query[qp];
    }
  });
  params['page[size]'] = queryParams.pageSize;
  params['page[type]'] = queryParams.pageType;
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}
