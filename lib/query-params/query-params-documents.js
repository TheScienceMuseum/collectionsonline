const formatValue = require('./format-value');

module.exports = function (typeFormat, queryParams) {
  var queryParamsDocuments = {};
  const type = queryParams.query['filter[type]'] || null;
  queryParamsDocuments.type = formatValue(typeFormat, type);

  const makers = queryParams.query['filter[makers]'] || null;
  queryParamsDocuments.makers = formatValue(typeFormat, makers);

  const people = queryParams.query['filter[people]'] || null;
  queryParamsDocuments.people = formatValue(typeFormat, people);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsDocuments.organisations = formatValue(typeFormat, organisations);

  const archive = queryParams.query['filter[archive]'] || null;
  queryParamsDocuments.archive = formatValue(typeFormat, archive);

  const formats = queryParams.query['filter[formats]'] || null;
  queryParamsDocuments.formats = formatValue(typeFormat, formats);

  const imageLicense = queryParams.query['filter[image_license]'] || null;
  queryParamsDocuments.imageLicense = formatValue(typeFormat, imageLicense);

  const hasImage = queryParams.query['filter[has_image]'] || null;
  queryParamsDocuments.hasImage = formatValue(typeFormat, hasImage);

  return queryParamsDocuments;
};
