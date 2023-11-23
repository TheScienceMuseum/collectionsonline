module.exports = function (selectedFilters, facet) {
  return Object.prototype.hasOwnProperty.call(selectedFilters, facet);
};
