const fs = require('fs');
const path = require('path');
const formatValue = require('./format-value');
const galleryList = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/../../fixtures/galleries.json'))
);

module.exports = function (typeFormat, queryParams) {
  const queryParamsObjects = {};

  const objectType = queryParams.query['filter[object_type]'] || null;
  queryParamsObjects.object_type = formatValue(typeFormat, objectType);

  const makers = queryParams.query['filter[makers]'] || null;
  queryParamsObjects.makers = formatValue(typeFormat, makers);

  const people = queryParams.query['filter[people]'] || null;
  queryParamsObjects.people = formatValue(typeFormat, people);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsObjects.organisations = formatValue(typeFormat, organisations);

  const categories = queryParams.query['filter[categories]'] || null;
  queryParamsObjects.categories = formatValue(typeFormat, categories);

  const collection = queryParams.query['filter[collection]'] || null;
  queryParamsObjects.collection = formatValue(typeFormat, collection);

  const gallery = queryParams.query['filter[gallery]'] || null;
  queryParamsObjects.gallery = formatValue(typeFormat, gallery);

  let museum = queryParams.query['filter[museum]'] || null;
  if (gallery && !museum) {
    museum = galleryList[gallery];
  }
  queryParamsObjects.museum = formatValue(typeFormat, museum);

  const onDisplay = queryParams.query['filter[on_display]'] || null;
  queryParamsObjects.onDisplay = onDisplay;

  const location = queryParams.query['filter[location]'] || null;
  queryParamsObjects.location = formatValue(typeFormat, location);

  const user = queryParams.query['filter[user]'] || null;
  queryParamsObjects.user = formatValue(typeFormat, user);

  const material = queryParams.query['filter[material]'] || null;
  queryParamsObjects.material = formatValue(typeFormat, material);

  const mphc = queryParams.query['filter[mphc]'] || null;
  queryParamsObjects.mphc = formatValue(typeFormat, mphc);

  const imgtag = queryParams.query['filter[imgtag]'] || null;
  queryParamsObjects.imgtag = formatValue(typeFormat, imgtag);

  let dateFrom = queryParams.query['filter[date[from]]'] || null;
  if (dateFrom) {
    if (Object.prototype.toString.call(dateFrom) !== '[object Date]') {
      if (isNaN(dateFrom)) {
        dateFrom = null;
      }
    }
  }
  queryParamsObjects.dateFrom = formatValue(typeFormat, dateFrom);

  let dateTo = queryParams.query['filter[date[to]]'] || null;
  if (dateTo) {
    if (Object.prototype.toString.call(dateTo) !== '[object Date]') {
      if (isNaN(dateTo)) {
        dateTo = null;
      }
    }
  }
  queryParamsObjects.dateTo = formatValue(typeFormat, dateTo);

  const places = queryParams.query['filter[places]'] || null;
  queryParamsObjects.places = formatValue(typeFormat, places);

  const imageLicense = queryParams.query['filter[image_license]'] || null;
  queryParamsObjects.imageLicense = formatValue(typeFormat, imageLicense);

  const hasImage = queryParams.query['filter[has_image]'] || null;
  queryParamsObjects.hasImage = formatValue(typeFormat, hasImage);

  const hasRotational = queryParams.query['filter[rotational]'] || null;
  queryParamsObjects.hasRotational = formatValue(typeFormat, hasRotational);

  return queryParamsObjects;
};
