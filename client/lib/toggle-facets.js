/**
* Add event listner on click on the facet which open or close the facet
* This function also update the general display state object for the facets
*/
module.exports = function (facetsStates, typeSearch) {
  var type = typeSearch || 'all';
  var facets = document.querySelectorAll('.filter:not(.filter--active):not(.filter--uncollapsible)');
  facets.forEach(function (facet) {
    var link = facet.querySelector('a');
    link.addEventListener('click', function (e) {
      e.preventDefault();
      facet.classList.toggle('filter--open');
      var facetName = facet.getAttribute('data-filter');
      var state = facetsStates[type][facetName];
      if (state === 'open') {
        facetsStates[type][facetName] = 'close';
      }
      if (state === 'close') {
        facetsStates[type][facetName] = 'open';
      }
    });
  });
};
