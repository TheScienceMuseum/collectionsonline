module.exports = function (statesFacets, typeSearch) {
  var type = typeSearch || 'all';

  var activeFacets = Array.prototype.slice.call(document.querySelectorAll('.filter--active:not(.filter--uncollapsible)'));
  var activeFacetNames = activeFacets.map(function (f) {
    return f.getAttribute('data-filter');
  });

  activeFacetNames.forEach(function (name) {
    statesFacets[type][name] = 'active';
  });

  var statesFacetsActive = [];
  var facetKeys = Object.keys(statesFacets[type]);
  for (var i = 0; i < facetKeys.length; i++) {
    if (statesFacets[type][facetKeys[i]] === 'active') {
      statesFacetsActive.push(facetKeys[i]);
    }
  }
  for (i = 0; i < statesFacetsActive.length; i++) {
    if (activeFacetNames.indexOf(statesFacetsActive[i]) === -1) {
      statesFacets[type][statesFacetsActive[i]] = 'open';
    }
  }
};
