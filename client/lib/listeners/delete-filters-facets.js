module.exports = function (facetsStates, typeSearch) {
  const type = typeSearch || 'all';
  const facets = Array.prototype.slice.call(
    document.querySelectorAll('.filter--active:not(.filter--uncollapsible)')
  );
  facets.forEach(function (facet) {
    const link = facet.querySelector('a');

    link.addEventListener('click', function (e) {
      const facetName = facet.getAttribute('data-filter');
      facetsStates[type][facetName] = 'open';
    });
  });
};
