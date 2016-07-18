const QueryString = require('querystring');
const formatNumber = require('format-number')();
const Pagination = require('../pagination');
const getValues = require('./get-values');
const getPrimaryValue = require('../get-primary-value');
// const splitOnUnescapedCommas = require('../../client/lib/split-commas.js');

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
      filterAll: createTypeFilterLink(null, queryParams, rootUrl),
      filterObjects: createTypeFilterLink('objects', queryParams, rootUrl),
      filterPeople: createTypeFilterLink('people', queryParams, rootUrl),
      filterDocuments: createTypeFilterLink('documents', queryParams, rootUrl),
      clearFilter: createClearFilterLink(queryParams, rootUrl)
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
  const params = {
    q: queryParams.q,
    'page[size]': queryParams.pageSize
  };
  type = type ? '/' + type : '';
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

function createClearFilterLink (queryParams, rootUrl) {
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const params = {
    q: queryParams.q,
    'page[size]': queryParams.pageSize
  };
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

/**
* create a selectedFilters Object
* {filter[occupation]: {'mathematician': true,...}, filter[date]: '1900'}
*/
// function createSelectedFilters (queryParams) {
//   var selectedFilters = {};
//   const facets = queryParams.query;
//
//   Object.keys(facets).forEach(filter => {
//     // TODO add a if condition when the type of the filter is a date
//     if ((typeof facets[filter] === 'string' || Array.isArray(facets[filter])) && filter !== 'q') {
//       var filters;
//       if (Array.isArray(facets[filter])) {
//         filters = facets[filter];
//       } else if (facets[filter].indexOf(',') > -1) {
//         filters = splitOnUnescapedCommas(facets[filter]);
//       } else {
//         filters = [facets[filter]];
//       }
//       filters.forEach(el => {
//         selectedFilters[filter] = selectedFilters[filter] || {};
//         selectedFilters[filter][el] = true;
//       });
//     }
//   });
//
//   // all
//   const facetsAll = queryParams.filter.all;
//   Object.keys(facetsAll).forEach(filter => {
//     if (facetsAll[filter]) {
//       selectedFilters[filter] = {};
//       if (Object.prototype.toString.call(facetsAll[filter]) === '[object Array]') {
//         facetsAll[filter].forEach(value => {
//           selectedFilters[filter][value] = true;
//         });
//       }
//       if (Object.prototype.toString.call(facetsAll[filter]) === '[object Date]') {
//         selectedFilters[filter] = facetsAll[filter].getFullYear();
//       }
//     }
//   });
//
//   return selectedFilters;
// }

function createSelectedFilters (queryParams) {
  var selectedFilters = {};
  const facets = queryParams.query;
  Object.keys(facets).forEach(filter => {
    var filters;
    if (filter !== 'q') {
      if (Array.isArray(facets[filter])) {
        filters = facets[filter];
      } else {
        filters = [facets[filter]];
      }
      filters.forEach(el => {
        selectedFilters[filter] = selectedFilters[filter] || {};
        selectedFilters[filter][el] = true;
      });
    }
  });

  const facetsAll = queryParams.filter.all;
  Object.keys(facetsAll).forEach(filter => {
    if (facetsAll[filter]) {
      selectedFilters[filter] = {};
      if (Object.prototype.toString.call(facetsAll[filter]) === '[object Array]') {
        facetsAll[filter].forEach(value => {
          selectedFilters[filter][value] = true;
        });
      }
      if (Object.prototype.toString.call(facetsAll[filter]) === '[object Date]') {
        selectedFilters[filter] = facetsAll[filter].getFullYear();
      }
    }
  });
  return selectedFilters;
}
