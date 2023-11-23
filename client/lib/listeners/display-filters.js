/**
* toggle classes for the filter
*/
module.exports = function (display) {
  const searchresults = document.querySelector('.searchresults');
  const filtercolumn = document.querySelector('.filtercolumn');
  const controlFilters = document.querySelector('.control--filters');

  if (searchresults && filtercolumn && controlFilters) {
    if (display) {
      searchresults.classList.add('searchresults--filtersactive');
      filtercolumn.classList.add('filtercolumn--filtersactive');
      controlFilters.classList.add('control--active');
    } else {
      searchresults.classList.remove('searchresults--filtersactive');
      filtercolumn.classList.remove('filtercolumn--filtersactive');
      controlFilters.classList.remove('control--active');
    }
  }
};
