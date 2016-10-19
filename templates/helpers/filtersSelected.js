module.exports = function (selectedFilters) {
  console.log('selected filters function');
  return Object.keys(selectedFilters).length > 0;
};
