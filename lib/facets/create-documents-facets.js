module.exports = function createDocumentFacets (results) {
  var archiveValues = [];
  results.aggregations.documents.archive.archive_filters.buckets.forEach(value => {
    archiveValues.push({ value: value.key, count: value.doc_count });
  });

  var organisationValues = [];
  results.aggregations.documents.organisation.organisation_filters.buckets.forEach(value => {
    organisationValues.push({ value: value.key, count: value.doc_count });
  });
  return {
    archive: archiveValues,
    organisation: organisationValues
  };
};
