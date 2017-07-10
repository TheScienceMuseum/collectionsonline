module.exports = function (data) {
  var result = {};

  addToLayer('query', data.q);
  addToLayer('type', data.type);
  addToLayer('category', data.categoryFilters);
  addToLayer('onDisplay', data.museumFilters);
  addToLayer('image', data.imageFilters);
  addToLayer('archive', data.archiveFilters);

  addToLayer('objectType', findSelected(data.selectedFilters.object_type));
  addToLayer('maker', findSelected(data.selectedFilters.makers));
  addToLayer('place', findSelected(data.selectedFilters.places));
  addToLayer('dateFrom', findSelected(data.selectedFilters['date[from]']));
  addToLayer('dateTo', findSelected(data.selectedFilters['date[to]']));

  return JSON.stringify(result);

  function addToLayer (key, val) {
    if (val && val.length !== 0) {
      result[key] = val;
    }
  }
};

function findSelected (obj) {
  var selected = [];

  if (obj) {
    selected = Object.keys(obj).filter(el => obj[el]);
  }

  return selected.length > 0 ? selected : null;
}
