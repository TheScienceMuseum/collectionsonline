const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsPeople = {};

  const birthPlace = queryParams.query['filter[birth[place]]'] || null;
  queryParamsPeople.birthPlace = formatValue(typeFormat, birthPlace);

  // convert string year to date type
  var birthDate = queryParams.query['filter[birth[date]]'] || queryParams.query['filter[date[from]]'] || null;
  if (birthDate) {
    if (Object.prototype.toString.call(birthDate) !== '[object Date]') {
      birthDate = new Date(birthDate);
    }
  }
  queryParamsPeople.birthDate = formatValue(typeFormat, birthDate);

  var deathDate = queryParams.query['filter[death[date]]'] || null;
  if (deathDate) {
    if (Object.prototype.toString.call(deathDate) !== '[object Date]') {
      deathDate = new Date(deathDate);
    }
  }
  queryParamsPeople.deathDate = formatValue(typeFormat, deathDate);

  const occupation = queryParams.query['filter[occupation]'] || null;
  queryParamsPeople.occupation = formatValue(typeFormat, occupation);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsPeople.organisations = formatValue(typeFormat, organisations);

  return queryParamsPeople;
};
