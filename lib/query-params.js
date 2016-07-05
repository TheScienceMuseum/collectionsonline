/**
* Create a query params Object
* Joi is already converting the query and params for the short name to the JSONAPI format
* ex: occupation to filter[occupation]
*/

module.exports = (typeFormat, queryParams) => {
  var result = {};
  result.query = queryParams.query;
  result.q = queryParams.query.q;
  result.pageNumber = queryParams.query['page[number]'] || 0;
  result.pageSize = queryParams.query['page[size]'] || 50;
  result.type = queryParams.params.type || queryParams.query['fields[type]'] || 'all';

  result.filter = {all: {}, objects: {}, people: {}, documents: {}};
  // All
  result.filter.all.dateFrom = queryParams.query['filter[date[from]]'] || null;
  result.filter.all.dateTo = queryParams.query['filter[date[to]]'] || null;
  const places = queryParams.query['filter[places]'] || null;
  result.filter.all.places = formatValue(typeFormat, places);

  // Objects
  const type = queryParams.query['filter[type]'] || null;
  result.filter.objects.type = formatValue(typeFormat, type);
  const makers = queryParams.query['filter[makers]'] || null;
  result.filter.objects.makers = formatValue(typeFormat, makers);
  const people = queryParams.query['filter[people]'] || null;
  result.filter.objects.people = formatValue(typeFormat, people);
  const organisations = queryParams.query['filter[organisations]'] || null;
  result.filter.objects.organisations = formatValue(typeFormat, queryParams.query['organisations']);
  const categories = queryParams.query['filter[categories]'] || null;
  result.filter.objects.categories = formatValue(typeFormat, categories);
  const museum = queryParams.query['filter[museum]'] || null;
  result.filter.objects.museum = formatValue(typeFormat, museum);
  const onDisplay = queryParams.query['filter[on_display]'] || null;
  result.filter.objects.onDisplay = onDisplay;
  const location = queryParams.query['filter[location]'] || null;
  result.filter.objects.location = formatValue(typeFormat, location);

  // People
  const birthPlace = queryParams.query['filter[birth[place]]'] || null;
  result.filter.people.birthPlace = formatValue(typeFormat, birthPlace);
  const birthDate = queryParams.query['filter[birth[date]]'] || null;
  result.filter.people.birthDate = birthDate;
  const deathDate = queryParams.query['filter[death[date]]'] || null;
  result.filter.people.deathDate = deathDate;
  const occupation = queryParams.query['filter[occupation]'] || null;
  result.filter.people.occupation = formatValue(typeFormat, occupation);
  result.filter.people.organisations = organisations;

  // Documents
  result.filter.documents.type = formatValue(typeFormat, type);
  result.filter.documents.makers = formatValue(typeFormat, makers);
  result.filter.documents.people = formatValue(typeFormat, people);
  result.filter.documents.organisations = formatValue(typeFormat, organisations);
  const archive = queryParams.query['filter[archive]'] || null;
  result.filter.documents.archive = formatValue(typeFormat, archive);
  const formats = queryParams.query['filter[formats]'] || null;
  result.filter.documents.formats = formatValue(typeFormat, formats);
  const imageLicences = queryParams.query['filter[image_licences]'] || null;
  result.filter.documents.imageLicences = formatValue(typeFormat, imageLicences);

  return result;
};

/**
* format the values to the right format depending of the origin of the requst, html or json
*/
function formatValue (typeFormat, value) {
  if (value) {
    if (typeFormat === 'html') {
      // convert string values to array
      return typeof value === 'string' ? [value] : value;
    }
    if (typeFormat === 'json') {
      return value.split(',');
    }
    return value;
  } else {
    return null;
  }
}
