/**
* Create a facet object.
* The properties of the object are the facets name
* The values are arrays of objects representing the main information of the facets:
* {occupation: [{value: 'Mathematician', count: 2}, ...],...}
*/
const createAllFacets = require('./create-all-facets');
const createPeopleFacets = require('./create-people-facets');
const createObjectsFacets = require('./create-objects-facets');
const createDocumentsFacets = require('./create-documents-facets');
module.exports = {
  'all': createAllFacets,
  'people': createPeopleFacets,
  'objects': createObjectsFacets,
  'documents': createDocumentsFacets
};
