/**
 * Create a selectedFilters object which represent the selected filters
 * {filter[occupation]: { 'mathematician': true, 'inventor': true}, filter[born[date]: 1800]}
 */
const removeFilterString = require('../helpers/remove-filter-string.js');
const dashToSpace = require('../helpers/dash-to-space.js');

module.exports = function (queryParams) {
  const selectedFilters = {};
  // {all: {}, people: {}, objects: {}, documents:{type: ['medals', 'photograph' ]}}
  const params = queryParams.query;

  Object.keys(params).forEach(function (el) {
    if (el === 'has_image' || el === 'filter[has_image]') {
      selectedFilters.hasImage = { true: true };
    } else if (el === 'image_license' || el === 'filter[image_license]') {
      selectedFilters.imageLicense = { true: true };
    } else if (
      el === 'filter[date[from]]' ||
      el === 'filter[date[to]]' ||
      el === 'date[from]' ||
      el === 'date[to]'
    ) {
      selectedFilters[removeFilterString(el)] = params[el];
    } else if (typeof params[el] === 'object') {
      selectedFilters[removeFilterString(el)] =
        selectedFilters[removeFilterString(el)] || {};
      params[el].forEach(function (e) {
        const unescaped = typeof e === 'string' ? e.replace(/\\,/g, ',') : e;
        selectedFilters[removeFilterString(el)][dashToSpace(unescaped)] = true;
      });
    } else {
      selectedFilters[removeFilterString(el)] =
        selectedFilters[removeFilterString(el)] || {};
      const unescaped = typeof params[el] === 'string' ? params[el].replace(/\\,/g, ',') : params[el];
      selectedFilters[removeFilterString(el)][unescaped] = true;
    }
  });

  return selectedFilters;
};
