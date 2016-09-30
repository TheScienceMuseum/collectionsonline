module.exports = function (queryParams) {
  const aggregationDocuments = {
    filter: {
      term: {'type.base': 'archive'}
    },
    aggs: {
      archive: {
        filter: {
          bool: {
            must: filter(queryParams)
          }
        },
        aggs: {
          archive_filters: {
            terms: { field: 'fonds.summary_title' }
          }
        }
      }
    }
  };

  return aggregationDocuments;
};

function filter (queryParams) {
  var filters = [];

 // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    filters.push({ terms: {'fonds.summary_title': archive} });
  }

  return filters;
}
