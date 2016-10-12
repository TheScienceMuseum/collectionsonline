module.exports = function (statesFacets, typeSearch) {
  var type = typeSearch || 'all';
  var activeFacets = document.querySelectorAll('.filter--active:not(.filter--uncollapsible)');
  activeFacets.forEach(function (facet) {
    var facetName = facet.getAttribute('data-filter');
    statesFacets[type][facetName] = 'active';
  });
};
