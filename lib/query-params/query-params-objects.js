const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsObjects = {};

  const type = queryParams.query['filter[type]'] || null;
  queryParamsObjects.type = formatValue(typeFormat, type);

  const makers = queryParams.query['filter[makers]'] || null;
  queryParamsObjects.makers = formatValue(typeFormat, makers);

  const people = queryParams.query['filter[people]'] || null;
  queryParamsObjects.people = formatValue(typeFormat, people);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsObjects.organisations = formatValue(typeFormat, organisations);

  const categories = queryParams.query['filter[categories]'] || null;
  queryParamsObjects.categories = formatValue(typeFormat, categories);

  const museum = queryParams.query['filter[museum]'] || null;
  queryParamsObjects.museum = formatValue(typeFormat, museum);

  const onDisplay = queryParams.query['filter[on_display]'] || null;
  queryParamsObjects.onDisplay = onDisplay;

  const location = queryParams.query['filter[location]'] || null;
  queryParamsObjects.location = formatValue(typeFormat, location);

  const user = queryParams.query['filter[user]'] || null;
  queryParamsObjects.user = formatValue(typeFormat, user);

  const material = queryParams.query['filter[material]'] || null;
  queryParamsObjects.material = formatValue(typeFormat, material);

  var dateFrom = queryParams.query['filter[date[from]]'] || null;
  if (dateFrom) {
    if (Object.prototype.toString.call(dateFrom) !== '[object Date]') {
      dateFrom = new Date(dateFrom);
      if (isNaN(dateFrom.getTime())) {
        dateFrom = null;
      }
    }
  }
  queryParamsObjects.dateFrom = formatValue(typeFormat, dateFrom);

  var dateTo = queryParams.query['filter[date[to]]'] || null;
  if (dateTo) {
    if (Object.prototype.toString.call(dateTo) !== '[object Date]') {
      dateTo = new Date(dateTo);
      if (isNaN(dateTo.getTime())) {
        dateTo = null;
      }
    }
  }
  queryParamsObjects.dateTo = formatValue(typeFormat, dateTo);

  const places = queryParams.query['filter[places]'] || null;
  queryParamsObjects.places = formatValue(typeFormat, places);

  return queryParamsObjects;
};
