module.exports = function (facetsStates, typeSearch) {
  var type = typeSearch || 'all';
  var facets = document.querySelectorAll('.filter');
  facets.forEach(function (facet) {
    var facetName = facet.getAttribute('data-filter');
    if (facetName) {
      var state = facetsStates[type][facetName];
      if (state === 'close') {
        facet.classList.remove('filter--open');
      }
      if (state === 'open') {
        facet.classList.add('filter--open');
      }
      if (state === 'active') {
        facet.classList.add('filter--open');
        facet.classList.add('filter--active');
      }
    }
  });
};
