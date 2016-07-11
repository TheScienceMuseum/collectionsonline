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
};
