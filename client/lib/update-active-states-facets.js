module.exports = function (statesFacets, typeSearch) {
  const type = typeSearch || 'all';

  const activeFacets = Array.prototype.slice.call(document.querySelectorAll('.filter--active:not(.filter--uncollapsible)'));
  const activeFacetNames = activeFacets.map(function (f) {
    return f.getAttribute('data-filter');
  });

  activeFacetNames.forEach(function (name) {
    statesFacets[type][name] = 'active';
  });

  const statesFacetsActive = [];
  const facetKeys = Object.keys(statesFacets[type]);
  for (let i = 0; i < facetKeys.length; i++) {
    if (statesFacets[type][facetKeys[i]] === 'active') {
      statesFacetsActive.push(facetKeys[i]);
    }
  }
  for (let i = 0; i < statesFacetsActive.length; i++) {
    if (activeFacetNames.indexOf(statesFacetsActive[i]) === -1) {
      statesFacets[type][statesFacetsActive[i]] = 'open';
    }
  }
};
