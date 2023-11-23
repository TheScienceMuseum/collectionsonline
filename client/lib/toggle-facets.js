/**
* Add event listner on click on the facet which open or close the facet
* This function also update the general display state object for the facets
*/
module.exports = function (facetsStates, typeSearch) {
  const type = typeSearch || 'all';
  const facets = Array.prototype.slice.call(document.querySelectorAll('.filter:not(.filter--active):not(.filter--uncollapsible)'));
  facets.forEach(function (facet) {
    const link = facet.querySelector('a');
    link.addEventListener('click', function (e) {
      e.preventDefault();
      facet.classList.toggle('filter--open');
      const facetName = facet.getAttribute('data-filter');
      const state = facetsStates[type][facetName];
      if (state === 'open') {
        facetsStates[type][facetName] = 'close';
      }
      if (state === 'close') {
        facetsStates[type][facetName] = 'open';
      }
    });
  });
};
