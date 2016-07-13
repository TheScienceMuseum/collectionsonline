/**
* Create a facet object.
* The properties of the object are the facets name
* The values are arrays of objects representing the main information of the facets:
* {occupation: [{value: 'Mathematician', count: 2}, ...],...}
*/
module.exports = {
  'all': require('./create-all-facets'),
  'people': require('./create-people-facets'),
  'objects': require('./create-objects-facets'),
  'documents': require('./create-documents-facets')
};
