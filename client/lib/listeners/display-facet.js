module.exports = function (facetsStates, typeSearch) {
  const type = typeSearch || 'all';
  const facets = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  facets.forEach(function (facet) {
    const facetName = facet.getAttribute('data-filter');
    if (facetName) {
      const state = facetsStates[type][facetName];
      if (state === 'close') {
        facet.classList.remove('filter--open');
        facet.classList.remove('filter--active');
      }
      if (state === 'open') {
        facet.classList.add('filter--open');
        facet.classList.remove('filter--active');
      }
      if (state === 'active') {
        facet.classList.add('filter--open');
        facet.classList.add('filter--active');
      }
    }
  });
};
