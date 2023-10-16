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

const truncate = require('./truncate.js');

module.exports = function (selectedFilters) {
  const museums = selectedFilters.museum
    ? Object.keys(selectedFilters.museum)
    : [];
  const gallery = selectedFilters.gallery
    ? Object.keys(selectedFilters.gallery)[0]
    : '';

  return museums.map(function (museum) {
    // short term 'fix' for museum name change
    let museumDisplayName = museum;
    if (museum === 'National Media Museum') museumDisplayName = 'Science and Media Museum';
    if (museum === 'Museum of Science and Industry') museumDisplayName = 'Science and Industry Museum';
    const locationName = gallery ? museumDisplayName + ' - ' + gallery : museumDisplayName;
    return {
      location: locationName,
      shortLocation: truncate(locationName, 40),
      museum,
      gallery
    };
  });
};
