const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsAll = {};
  var dateFrom = queryParams.query['filter[date[from]]'] || null;
  queryParamsAll.dateFrom = formatValue(typeFormat, dateFrom);

  var dateTo = queryParams.query['filter[date[to]]'] || null;
  queryParamsAll.dateTo = formatValue(typeFormat, dateTo);

  const places = queryParams.query['filter[places]'] || null;
  queryParamsAll.places = formatValue(typeFormat, places);

  return queryParamsAll;
};
