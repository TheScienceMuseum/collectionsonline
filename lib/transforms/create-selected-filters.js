/**
* Create a selectedFilters object which represent the selected fitlters
* {filter[occupation]: { 'mathematician': true, 'inventor': true}, filter[born[date]: 1800]}
*/
var removeFilterString = require('../helpers/remove-filter-string.js');

module.exports = function (queryParams) {
  var selectedFilters = {};
  // {all: {}, people: {}, objects: {}, documents:{type: ['medals', 'photograph' ]}}
  var filtersType = queryParams.filter;
  var params = queryParams.query;

  Object.keys(params).forEach(function (el) {
    if (el === 'has_image' || el === 'filter[has_image]') {
      selectedFilters['hasImage'] = { true: true };
    }
    selectedFilters[removeFilterString(el)] = selectedFilters[removeFilterString(el)] || {};
    selectedFilters[removeFilterString(el)][params[el]] = true;
  });

  return selectedFilters;
};
