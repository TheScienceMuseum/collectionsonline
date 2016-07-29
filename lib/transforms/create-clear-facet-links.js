/**
* Create the url for each facet
*/
const queryParamsPerCategory = require('../query-params/query-params-per-category');
const QueryString = require('querystring');

module.exports = function (queryParams, rootUrl) {
  const links = {};
  const type = queryParams.type !== 'all' ? '/' + queryParams.type : '';
  const facetsName = queryParamsPerCategory[queryParams.type];
  facetsName.forEach(function (facet) {
    links[facet] = `${rootUrl}/search${type}?${QueryString.stringify(ignoreQueryParam([facet], queryParams.query))}`;
  });
  // special links for the date: need to ignore the both date at the same time
  const facetsDate = ['filter[date[from]]', 'filter[date[to]]', 'filter[birth[date]]', 'filter[death[date]]'];
  links['dates'] = `${rootUrl}/search${type}?${QueryString.stringify(ignoreQueryParam(facetsDate, queryParams.query))}`;
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
