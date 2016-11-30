const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsAll = {};
  var dateFrom = queryParams.query['filter[date[from]]'] || queryParams.query['date[from]'] || null;
  queryParamsAll.dateFrom = formatValue(typeFormat, dateFrom);

  var dateTo = queryParams.query['filter[date[to]]'] || queryParams.query['date[to]'] || null;
  queryParamsAll.dateTo = formatValue(typeFormat, dateTo);

  const places = queryParams.query['filter[places]'] || null;
  queryParamsAll.places = formatValue(typeFormat, places);

  const imageLicense = queryParams.query['filter[image_license]'] || null;
  queryParamsAll.imageLicense = formatValue(typeFormat, imageLicense);

  const hasImage = queryParams.query['filter[has_image]'] || null;
  queryParamsAll.hasImage = formatValue(typeFormat, hasImage);

  return queryParamsAll;
};
