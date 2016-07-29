const QueryString = require('querystring');
const formatNumber = require('format-number')();
const Pagination = require('../pagination');
const getValues = require('./get-values');
const getPrimaryValue = require('../get-primary-value');
const createSelectedFilters = require('./create-selected-filters');
const getNestedProperty = require('../nested-property');

module.exports = (queryParams, results, config) => {
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const data = {
    title: 'Search our collection | Science Museum Group Collection',
    titlePage: 'Search our collection | Science Museum Group Collection',
    page: results.data.length ? queryParams.pageType : 'noresults',
    q: queryParams.q,
    results: results.data.map(createResult),
    pagination: createPagination(queryParams, results, rootUrl),
    filters: results.meta.filters,
    selectedFilters: createSelectedFilters(queryParams),
    meta: results.meta,
    links: {
      filterAll: createTypeFilterLink(null, queryParams, rootUrl),
      filterObjects: createTypeFilterLink('objects', queryParams, rootUrl),
      filterPeople: createTypeFilterLink('people', queryParams, rootUrl),
      filterDocuments: createTypeFilterLink('documents', queryParams, rootUrl),
      clearFilter: createClearFilterLink(queryParams, rootUrl),
      grid: createTypePageLink('search', queryParams, rootUrl),
      list: createTypePageLink('results-list', queryParams, rootUrl)
    }
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
    level: getValues.getDocumentLevel(item)
  };
}

function getCategory (item) {
  return getPrimaryValue(item.attributes.categories);
}

function getOccupation (item) {
  return getPrimaryValue(item.attributes.occupation);
}

function getFigure (item) {
  return null; // No images in index yet
}

function getFigCaption (item) {
  if (item.type === 'objects') {
    return getPrimaryValue(item.attributes.description) || getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
  } else if (item.type === 'people') {
    return getBriefBiography(item);
  } else if (item.type === 'documents') {
    return getPrimaryValue(getNestedProperty(item, 'attributes.measurements.dimensions')) || getPrimaryValue(item.attributes.description) || getPrimaryValue(item.attributes.title);
  }
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
