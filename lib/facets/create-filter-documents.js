const unescapeCommas = require('../unescape-commas');

module.exports = function (queryParams) {
  var filters = [];

  const archive = queryParams.filter.documents.archive;
  if (archive) {
    filters.push({ terms: {'fonds.summary_title': archive} });
  }

  // organisation
  const organisations = queryParams.filter.documents.organisations;
  if (organisations) {
    filters.push({ terms: {'organisations.name.value': organisations} });
  }

  return filters.map(unescapeCommas);
};
