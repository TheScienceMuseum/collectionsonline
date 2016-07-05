const QueryString = require('querystring');
const formatNumber = require('format-number')();
const Pagination = require('../pagination');
const getValues = require('./get-values');
const getNestedProperty = require('../nested-property');

module.exports = (queryParams, results, config) => {
  config = config || {};
  const rootUrl = config.rootUrl || '';

  const data = {
    title: 'Search Results',
    page: results.data.length ? 'search' : 'noresults',
    q: queryParams.q,
    results: results.data.map(createResult),
    pagination: createPagination(queryParams, results, rootUrl),
    filters: results.meta.filters,
    selectedFilters: createSelectedFilters(queryParams),
    meta: results.meta,
    links: {
      filterAll: createTypeFilterLink(null, queryParams.query, rootUrl),
      filterObjects: createTypeFilterLink('objects', queryParams.query, rootUrl),
      filterPeople: createTypeFilterLink('people', queryParams.query, rootUrl),
      filterDocuments: createTypeFilterLink('documents', queryParams.query, rootUrl)
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

  console.log(data.selectedFilters);
  return data;
};

function createResult (item) {
  return {
    type: item.type,
    title: getTitle(item),
    category: getCategory(item),
    date: getDate(item),
    figure: getFigure(item),
    figcaption: getFigCaption(item),
    link: item.links && item.links.self,
    occupation: getOccupation(item),
    isOnDisplay: getValues.getDisplayLocation(item),
    level: getValues.getDocumentLevel(item)
  };
}

function getTitle (item) {
  return getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
}

function getCategory (item) {
  return getPrimaryValue(item.attributes.categories);
}

function getOccupation (item) {
  return getPrimaryValue(item.attributes.occupation);
}

function getDate (item) {
  if (item.type === 'objects' || item.type === 'documents') {
    return getValues.getMadeDate(item);
  }

  const birth = getNestedProperty(item, 'attributes.lifecycle.birth.0.date.0.latest') || null;
  const death = getNestedProperty(item, 'attributes.lifecycle.death.0.date.0.latest') || null;

  if (birth && death) {
    return birth + ' - ' + death;
  } else if (!death) {
    return birth;
  } else {
    return 'Unknown - ' + death;
  }
}

function getFigure (item) {
  if (item.type === 'documents') return '/assets/img/archive.svg';
  return null; // No images in index yet
}

function getFigCaption (item) {
  if (item.type === 'objects') {
    return getPrimaryValue(item.attributes.description) || getPrimaryValue(item.attributes.title) || item.attributes.summary_title;
  } else if (item.type === 'people') {
    return getBriefBiography(item);
  }
}

function getPrimaryValue (array) {
  if (Object.prototype.toString.call(array) === '[object String]') {
    return array;
  }

  if (!Array.isArray(array) || !array.length) {
    return null;
  }

  const primary = array.find((d) => d.primary);
  return primary ? primary.value : array[0].value;
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

function createTypeFilterLink (type, params, rootUrl) {
  params = Object.assign({}, params);
  delete params['fields[type]'];
  // resset the page numbers
  delete params['page[number]'];
  type = type ? '/' + type : '';
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

/**
* create a selectedFilters Object
* {filter[occupation][mathematician]: true, ...}
*/
function createSelectedFilters (queryParams) {
  var selectedFilters = {};
  const type = queryParams.type;
  const facets = queryParams.filter[type];
  Object.keys(facets).forEach(filter => {
    if (facets[filter]) {
      selectedFilters[filter] = {};
      if (Object.prototype.toString.call(facets[filter]) === '[object Array]') {
        facets[filter].forEach(value => {
          selectedFilters[filter][value] = true;
        });
      }
      if (Object.prototype.toString.call(facets[filter]) === '[object Date]') {
        selectedFilters[filter] = facets[filter];
      }
    }
  });
  return selectedFilters;
}
