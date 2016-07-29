module.exports = function (queryParams) {
  var filters = [];
  // type
  filters.push({ term: {'type.base': 'archive'} });

  const archive = queryParams.filter.documents.archive;
  if (archive) {
    filters.push({ terms: {'fonds.summary_title': archive} });
  }

  // organisation
  const organisations = queryParams.filter.documents.organisations;
  if (organisations) {
    filters.push({ terms: {'organisations.name.value': organisations} });
  }

  return {bool: {must: filters}};
};
