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
      },
      organisation: {
        filter: {
          bool: {
            must: filter(queryParams)
          }
        },
        aggs: {
          organisation_filters: {
            terms: { field: 'organisations.name.value' }
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

  // organisation
  const organisations = queryParams.filter.documents.organisations;
  if (organisations) {
    filters.push({ terms: {'organisations.name.value': organisations} });
  }

  return filters;
}
