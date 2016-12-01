'use strict';

/*
* Return an array of on display location used for the pillbox
* Each object.location is the concatenation of the museum and the gallery name
[{location: 'fullNameLocation', shortLocation: 'truncated location'}, ...]

parameter selectedFilters format:

{ gallery: { Warehouse: true },
  museum: { 'National Railway Museum': true },
  ...
}
*/

var truncate = require('./truncate.js');

module.exports = function (selectedFilters) {
  var museums = selectedFilters.museum
    ? Object.keys(selectedFilters.museum)
    : [];
  var gallery = selectedFilters.gallery
    ? Object.keys(selectedFilters.gallery)[0]
    : '';

  return museums.map(function (museum) {
    var locationName = gallery ? museum + ' - ' + gallery : museum;

    return {
      location: locationName,
      shortLocation: truncate(locationName, 40),
      museum: museum,
      gallery: gallery
    };
  });
};
