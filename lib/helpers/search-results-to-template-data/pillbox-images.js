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
  const filterValues = {
    hasImage: { name: 'hasImage', value: 'Has image' },
    imageLicense: { name: 'imageLicense', value: 'Image license' }
  };
  const pillboxFilters = [];

  Object.keys(selectedFilters).forEach(function (filter) {
    if (Object.prototype.hasOwnProperty.call(filterValues, filter)) {
      pillboxFilters.push(filterValues[filter]);
    }
  });

  return pillboxFilters;
};
