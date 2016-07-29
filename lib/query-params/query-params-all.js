const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsAll = {};
  var dateFrom = queryParams.query['filter[date[from]]'] || null;
  if (dateFrom) {
    if (Object.prototype.toString.call(dateFrom) !== '[object Date]') {
      dateFrom = new Date(dateFrom);
    }
  }
  queryParamsAll.dateFrom = formatValue(typeFormat, dateFrom);

  var dateTo = queryParams.query['filter[date[to]]'] || null;
  if (dateTo) {
    if (Object.prototype.toString.call(dateTo) !== '[object Date]') {
      dateTo = new Date(dateTo);
    }
  }
  queryParamsAll.dateTo = formatValue(typeFormat, dateTo);

  const places = queryParams.query['filter[places]'] || null;
  queryParamsAll.places = formatValue(typeFormat, places);

  return queryParamsAll;
};
