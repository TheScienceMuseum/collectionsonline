'use strict';

/**
* The filter for images is defined like this
*
* { imageLicense: { true: true },
*   hasImage: { true: true }
* }
*
*
*/

module.exports = function (selectedFilters) {
  var filterValues = {
    hasImage: { name: 'hasImage', value: 'Has image' },
    imageLicense: { name: 'imageLicense', value: 'Image license' }
  };
  var pillboxFilters = [];

  Object.keys(selectedFilters).forEach(function (filter) {
    if (filterValues.hasOwnProperty(filter)) {
      pillboxFilters.push(filterValues[filter]);
    }
  });

  return pillboxFilters;
};
