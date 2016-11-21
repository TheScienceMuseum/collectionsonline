/**
* Build a JSONAPI formated object
*/

const QueryString = require('querystring');
const TypeMapping = require('../type-mapping');
const createFacets = require('../facets/create-facets');
const checkPurchased = require('../check-purchased');
const getNestedProperty = require('../nested-property');
const slug = require('slug');

module.exports = (queryParams, results, config) => {
  results = results || {};
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const mediaPath = config.mediaPath || '';
  const resources = createResources(results, rootUrl, mediaPath);
  const data = resources.data;
  const included = resources.included;
  const links = createLinks(queryParams, results, rootUrl);
  const meta = createMeta(queryParams, results);

  return { data, included, links, meta };
};

// Create resources from hits, filter any unknown resource types
function createResources (results, rootUrl, mediaPath) {
  const hits = (results.hits || {}).hits || [];

  return hits.reduce((resources, hit) => {
    // Create a resource if a creator exists for the hit._type
    const creator = createResource[hit._type];

    if (!creator) {
      console.warn(`No resource creator for hit ${hit._id}`);
      return resources;
    }

    const res = creator(hit, rootUrl, mediaPath);
    return { data: resources.data.concat(res.data), included: resources.included.concat(res.included) };
  }, { data: [], included: [] });
}

const createResource = {
  object (hit, rootUrl, mediaPath) {
    const type = 'objects';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      'arrangement',
      'autocomplete',
      'categories',
      'component',
      'condition',
      'custodial_history',
      'dates',
      'description',
      'identifier',
      'inscription',
      'language',
      'legal',
      'lifecycle',
      'locations',
      'materials',
      'measurements',
      'multimedia',
      'name',
      'note',
      'numbers',
      'options',
      'reference_links',
      'summary_title',
      'summary_title_text',
      'title'
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
        // temporary - restrict credit line if it contains 'Purchased'
        // https://github.com/TheScienceMuseum/collectionsonline/issues/195
        if (key === 'legal' && checkPurchased(attrs, key)) {
          delete attrs[key].credit_line;
        }
        // Adds image host to path
        if (key === 'multimedia' && getNestedProperty(hit, '_source.multimedia.0.processed.medium.location')) {
          attrs[key][0].processed.medium.location = mediaPath + hit._source[key][0].processed.medium.location;
        }
      }
      return attrs;
    }, {});

    const rels = createRelationships(hit, [
      'agents',
      'cultures',
      'events',
      'parent',
      'places',
      'terms'
    ], rootUrl);

    const relationships = rels.relationships;
    const included = rels.included;
    const links = { self: `${rootUrl}/objects/${id}/${slug(attributes.summary_title, {lower: true})}` };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  agent (hit, rootUrl) {
    const type = 'people';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      'admin',
      'date_of_birth',
      'date_of_death',
      'death_date',
      'description',
      'gender',
      'historical',
      'identifier',
      'life_dates',
      'lifecycle',
      'name',
      'nationality',
      'note',
      'occupation',
      'reference_links',
      'summary_title',
      'summary_title_text',
      'title',
      'website'
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
      }
      return attrs;
    }, {});

    const rels = createRelationships(hit, [
      'agents',
      'places',
      'terms'
    ], rootUrl);

    const relationships = rels.relationships;
    const included = rels.included;
    const links = { self: `${rootUrl}/people/${id}/${slug(attributes.summary_title, {lower: true})}` };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  archive (hit, rootUrl, mediaPath) {
    const type = 'documents';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      'arrangement',
      'description',
      'identifier',
      'legal',
      'level',
      'measurements',
      'multimedia',
      'name',
      'note',
      'reference_links',
      'summary_title',
      'summary_title_text',
      'title',
      'web'
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];

        // Adds image host to path
        if (key === 'multimedia' && getNestedProperty(hit, '_source.multimedia.0.processed.medium.location')) {
          attrs[key][0].processed.medium.location = mediaPath + hit._source[key][0].processed.medium.location;
        }
      }
      return attrs;
    }, {});

    const rels = createRelationships(hit, [
      'agents',
      'archives',
      'fonds',
      'organisations',
      'parent'
    ], rootUrl);

    const relationships = rels.relationships;
    const included = rels.included;
    const links = { self: `${rootUrl}/documents/${id}/${slug(attributes.summary_title, {lower: true})}` };

    return { data: { type, id, attributes, relationships, links }, included };
  }
};

function createRelationships (hit, props, rootUrl) {
  // Reference relationships
  const relationships = props.reduce((rels, key) => {
    if (hit._source && hit._source[key] && hit._source[key].length) {
      const type = TypeMapping.toExternal(key);

      rels[type] = {
        data: hit._source[key].map((r) => {
          const id = TypeMapping.toExternal(r.admin && r.admin.uid);
          return { type, id };
        })
      };
    }
    return rels;
  }, {});

  // Add included docs
  const included = props.reduce((incs, key) => {
    if (hit._source && hit._source[key] && hit._source[key].length) {
      const type = TypeMapping.toExternal(key);

      const resources = hit._source[key].map((r) => {
        const id = TypeMapping.toExternal(r.admin && r.admin.uid);

        return {
          type,
          id,
          attributes: { summary_title: r.summary_title },
          links: { self: `${rootUrl}/${type}/${id}` }
        };
      });

      incs = incs.concat(resources);
    }
    return incs;
  }, []);

  return { relationships, included };
}

// Creates a top level links object
function createLinks (queryParams, results, rootUrl) {
  const totalPages = Math.ceil(results.hits.total / queryParams.pageSize);
  const pageNumber = queryParams.pageNumber;
  const type = queryParams.type !== 'all' ? queryParams.type : null;
  const self = searchUrl(type, rootUrl, queryParams.query);
  const first = searchUrl(type, rootUrl, xtend(queryParams.query, { 'page[number]': 0 }));
  const last = searchUrl(type, rootUrl, xtend(queryParams.query, { 'page[number]': totalPages - 1 }));
  const prev = pageNumber > 0
    ? searchUrl(type, rootUrl, xtend(queryParams.query, { 'page[number]': pageNumber - 1 }))
    : null;
  const next = pageNumber < totalPages - 1
    ? searchUrl(type, rootUrl, xtend(queryParams.query, { 'page[number]': pageNumber + 1 }))
    : null;

  return { self, first, last, prev, next };
}

function searchUrl (type, rootUrl, params) {
  type = type ? '/' + type : '';
  delete params['fields[type]'];
  return `${rootUrl}/search${type}?${QueryString.stringify(params)}`;
}

function createMeta (queryParams, results) {
  const total = (results.hits || {}).total || 0;
  const totalPages = Math.ceil(total / queryParams.pageSize);
  const countCategories = createCountCategories(queryParams.type, results);
  return { total_pages: totalPages, count: {type: countCategories}, filters: createFacets(results) };
}

function createCountCategories (type, results) {
  const result = { all: 0, people: 0, objects: 0, documents: 0 };
  const aggs = results.aggregations.total_categories;
  const numbers = {all: 0, people: 0, objects: 0, documents: 0};
  if (type !== 'all') {
    numbers.people = aggs.people.people_total.value;
    numbers.objects = aggs.objects.objects_total.value;
    numbers.documents = aggs.documents.documents_total.value;
    numbers.all = numbers.people + numbers.objects + numbers.documents;
  } else {
    numbers.all = aggs.all.doc_count;
    const buckets = aggs.all.all_total.buckets;
    buckets.forEach(bucket => {
      numbers[TypeMapping.toExternal(bucket.key)] = bucket.doc_count;
    });
  }

  result.all += numbers.all ? numbers.all : 0;
  result.people += numbers.people ? numbers.people : 0;
  result.objects += numbers.objects ? numbers.objects : 0;
  result.documents += numbers.documents ? numbers.documents : 0;
  return result;
}

function xtend (obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}
