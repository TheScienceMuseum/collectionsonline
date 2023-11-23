/**
* return true if at least one filter is selected
*/
module.exports = function (results, selectedFilters) {
  let display = true;
  if (results.length === 0 && Object.keys(selectedFilters).length === 0) {
    display = false;
  }
  return display;
};
