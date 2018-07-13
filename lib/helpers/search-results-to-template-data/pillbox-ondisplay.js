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
    // short term 'fix' for museum name change
    var museumDisplayName = (museum === 'National Media Museum' || museum === 'National Science and Media Museum') ? 'Media Museum' : museum;
    var locationName = gallery ? museumDisplayName + ' - ' + gallery : museumDisplayName;

    return {
      location: locationName,
      shortLocation: truncate(locationName, 40),
      museum: museum,
      gallery: gallery
    };
  });
};
