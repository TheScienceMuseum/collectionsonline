const formatValue = require('./format-value');

module.exports = (typeFormat, queryParams) => {
  const queryParamsGroup = {};
  const objectType = queryParams.query['filter[object_type]'] || null;
  queryParamsGroup.object_type = formatValue(typeFormat, objectType);

  const makers = queryParams.query['filter[makers]'] || null;
  queryParamsGroup.makers = formatValue(typeFormat, makers);

  const people = queryParams.query['filter[people]'] || null;
  queryParamsGroup.people = formatValue(typeFormat, people);

  const organisations = queryParams.query['filter[organisations]'] || null;
  queryParamsGroup.organisations = formatValue(typeFormat, organisations);

  const archive = queryParams.query['filter[archive]'] || null;
  queryParamsGroup.archive = formatValue(typeFormat, archive);

  const formats = queryParams.query['filter[formats]'] || null;
  queryParamsGroup.formats = formatValue(typeFormat, formats);

  const imageLicense = queryParams.query['filter[image_license]'] || null;
  queryParamsGroup.imageLicense = formatValue(typeFormat, imageLicense);

  const hasImage = queryParams.query['filter[has_image]'] || null;
  queryParamsGroup.hasImage = formatValue(typeFormat, hasImage);

  return queryParamsGroup;
};
