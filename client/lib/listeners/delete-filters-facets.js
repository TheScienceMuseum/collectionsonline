module.exports = function (facetsStates, typeSearch) {
  var type = typeSearch || 'all';
  var facets = Array.prototype.slice.call(document.querySelectorAll('.filter--active:not(.filter--uncollapsible)'));
  facets.forEach(function (facet) {
    var link = facet.querySelector('a');
    link.addEventListener('click', function (e) {
      var facetName = facet.getAttribute('data-filter');
      facetsStates[type][facetName] = 'open';
    });
  });
};
