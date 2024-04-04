/**
 * Create the url for each facet
 */
const queryParamsPerCategory = require('../query-params/query-params-per-category');
const paramify = require('../helpers/paramify.js');
const querify = require('../helpers/querify.js');
const removeFilter = require('../helpers/remove-filter-string.js');

module.exports = function (queryParams, rootUrl) {
  const links = {};
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const facetsName = queryParamsPerCategory[queryParams.type];
  facetsName.forEach(function (facet) {
    links[facet] = `${rootUrl}/search${type}${paramify(
      ignoreQueryParam([facet, removeFilter(facet)], queryParams.query)
    )}${querify(
      ignoreQueryParam([facet, removeFilter(facet)], queryParams.query)
    )}`;
  });

  // TODO: see if needed
  // const facetsSubGroup = ['filter[subgroup]'];

  // special links for the date: need to ignore the both date at the same time
  const facetsDate = [
    'filter[date[from]]',
    'filter[date[to]]',
    'filter[birth[date]]',
    'filter[death[date]]'
  ];
  links.dates = `${rootUrl}/search${type}${paramify(
    ignoreQueryParam(facetsDate, queryParams.query)
  )}${querify(ignoreQueryParam(facetsDate, queryParams.query))}`;

  // special link for images: ignore has_image AND image_license
  const facetsImage = ['has_image', 'image_license'];
  links['filter[images]'] = `${rootUrl}/search${type}${paramify(
    ignoreQueryParam(facetsImage, queryParams.query)
  )}${querify(ignoreQueryParam(facetsImage, queryParams.query))}`;

  // special link for on display: ignore museum AND gallery
  const musemFacets = [
    'filter[museum]',
    'filter[gallery]',
    'museum',
    'gallery'
  ];
  links['filter[museum]'] = `${rootUrl}/search${type}${paramify(
    ignoreQueryParam(musemFacets, queryParams.query)
  )}${querify(ignoreQueryParam(musemFacets, queryParams.query))}`;
  return links;
};

function ignoreQueryParam (param, queryParams) {
  const result = {};
  Object.keys(queryParams).forEach(function (k) {
    if (param.indexOf(k) === -1) {
      result[k] = queryParams[k];
    }
  });

  return result;
}
