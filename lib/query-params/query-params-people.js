const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsPeople = {};

  const birthPlace = queryParams.query['filter[birth[place]]'] || null;
  queryParamsPeople.birthPlace = formatValue(typeFormat, birthPlace);

  const birthDate = queryParams.query['filter[birth[date]]'] || null;
  queryParamsPeople.birthDate = formatValue(typeFormat, birthDate);

  const deathDate = queryParams.query['filter[death[date]]'] || null;
  queryParamsPeople.deathDate = formatValue(typeFormat, deathDate);

  const occupation = queryParams.query['filter[occupation]'] || null;
  queryParamsPeople.occupation = formatValue(typeFormat, occupation);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsPeople.organisations = formatValue(typeFormat, organisations);

  return queryParamsPeople;
};
