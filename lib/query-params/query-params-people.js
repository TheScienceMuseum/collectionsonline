const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  const queryParamsPeople = {};

  const birthPlace = queryParams.query['filter[birth[place]]'] || null;
  queryParamsPeople.birthPlace = formatValue(typeFormat, birthPlace);

  // convert string year to date type
  let birthDate = queryParams.query['filter[birth[date]]'] || queryParams.query['filter[date[from]]'] || null;
  if (birthDate) {
    if (isNaN(birthDate)) {
      birthDate = null;
    }
  }
  queryParamsPeople.birthDate = formatValue(typeFormat, birthDate);

  let deathDate = queryParams.query['filter[death[date]]'] || queryParams.query['filter[date[to]]'] || null;
  if (deathDate) {
    if (isNaN(deathDate)) {
      deathDate = null;
    }
  }
  queryParamsPeople.deathDate = formatValue(typeFormat, deathDate);

  const occupation = queryParams.query['filter[occupation]'] || null;
  queryParamsPeople.occupation = formatValue(typeFormat, occupation);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsPeople.organisations = formatValue(typeFormat, organisations);

  return queryParamsPeople;
};
