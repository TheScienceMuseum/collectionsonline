module.exports = function (selectedFilters) {
  return (selectedFilters.hasOwnProperty('dateFrom') || selectedFilters.hasOwnProperty('dateTo'));
};
