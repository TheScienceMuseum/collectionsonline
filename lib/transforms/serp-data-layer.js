module.exports = function (data) {
  const result = {};

  addToLayer('serpQuery', data.q);
  addToLayer('serpType', data.type);
  addToLayer('serpCategory', data.categoryFilters);
  addToLayer('serpOnDisplay', data.museumFilters);
  addToLayer('serpImage', data.imageFilters);
  addToLayer('serpArchive', data.archiveFilters);

  addToLayer('serpObjectType', findSelected(data.selectedFilters.object_type));
  addToLayer('serpMaker', findSelected(data.selectedFilters.makers));
  addToLayer('serpPlace', findSelected(data.selectedFilters.places));
  addToLayer('serpDateFrom', findSelected(data.selectedFilters['date[from]']));
  addToLayer('serpDateTo', findSelected(data.selectedFilters['date[to]']));

  return JSON.stringify(result);

  function addToLayer (key, val) {
    if (val && val.length !== 0) {
      result[key] = encodeURIComponent(val);
    }
  }
};

function findSelected (obj) {
  let selected = [];

  if (obj) {
    selected = Object.keys(obj).filter(el => obj[el]);
  }

  return selected.length > 0 ? selected : null;
}
