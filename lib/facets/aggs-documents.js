module.exports = function (queryParams) {
  const aggregationDocuments = {
    filter: {
      term: {'type.base': 'archive'}
    },
    aggs: {
      archive: {
        filter: {
          bool: {
            must: filter(queryParams, 'archive')
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
            must: filter(queryParams, 'organisation')
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

function filter (queryParams, exclude) {
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

  return filters.map(el => {
    var filt = {
      terms: {}
    };
    if (el.terms && Array.isArray(el.terms[Object.keys(el.terms)[0]])) {
      filt.terms[Object.keys(el.terms)[0]] = el.terms[Object.keys(el.terms)[0]].map(el => {
        return el.replace(/\\,/g, ',');
      });
    }
    return filt;
  });
}
