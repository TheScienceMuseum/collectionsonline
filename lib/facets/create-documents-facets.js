module.exports = function createDocumentFacets (results) {
  const d = results.aggregations.documents;
  return {
    archive: d.archive.archive_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    organisation: d.organisation.organisation_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; })
  };
};
