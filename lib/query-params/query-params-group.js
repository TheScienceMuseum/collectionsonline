const formatValue = require('./format-value');

module.exports = (typeFormat, queryParams) => {
  const queryParamsGroup = {};

  const subgroup = queryParams.query['filter[subgroup]'];
  queryParamsGroup.subgroup = formatValue(typeFormat, subgroup);

  return queryParamsGroup;
};
