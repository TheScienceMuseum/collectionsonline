const QueryString = require('querystring');
const TypeMapping = require('../type-mapping');

module.exports = (params, results = {}, config = {}) => {
  const rootUrl = config.rootUrl || '';
  const { data, included } = createData(results, rootUrl);
  const links = createLinks(params, results, rootUrl);
  const meta = createMeta(params, results);

  return { data, included, links, meta };
};

// Create resources from hits, filter any unknown resource types
function createData (results, rootUrl) {
  const hits = (results.hits || {}).hits || [];

  return hits.reduce(({ data, included }, hit) => {
    // Create a resource if a creator exists for the hit._type
    const creator = createResource[hit._type];

    if (!creator) {
      console.warn(`No resource creator for hit ${hit._id}`);
      return { data, included };
    }

    const res = creator(hit, rootUrl);
    return { data: data.concat(res.data), included: included.concat(res.included) };
  }, { data: [], included: [] });
}

const createResource = {
  object (hit, rootUrl) {
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
      'location',
      'materials',
      'measurements',
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
      }
      return attrs;
    }, {});

    const { relationships, included } = createRelationships(hit, [
      'agents',
      'cultures',
      'events',
      'parent',
      'places',
      'terms'
    ], rootUrl);

    const links = { self: `${rootUrl}/objects/${id}` };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  agent (hit, rootUrl) {
    const type = 'people';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
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

    const { relationships, included } = createRelationships(hit, [
      'agents',
      'places',
      'terms'
    ], rootUrl);

    const links = { self: `${rootUrl}/people/${id}` };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  archive (hit, rootUrl) {
    const type = 'documents';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      'arrangement',
      'description',
      'identifier',
      'legal',
      'level',
      'measurements',
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
      }
      return attrs;
    }, {});

    const { relationships, included } = createRelationships(hit, [
      'agents',
      'archives',
      'fonds',
      'organisations',
      'parent'
    ], rootUrl);

    const links = { self: `${rootUrl}/documents/${id}` };

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
function createLinks (params, results = {}, rootUrl) {
  const totalPages = Math.ceil(results.hits.total / (params['page[size]'] || 50));
  const pageNumber = params['page[number]'] || 0;

  const self = searchUrl(rootUrl, params);
  const first = searchUrl(rootUrl, xtend(params, { 'page[number]': 0 }));
  const last = searchUrl(rootUrl, xtend(params, { 'page[number]': totalPages - 1 }));
  const prev = pageNumber > 0
    ? searchUrl(rootUrl, xtend(params, { 'page[number]': pageNumber - 1 }))
    : null;
  const next = pageNumber < totalPages - 1
    ? searchUrl(rootUrl, xtend(params, { 'page[number]': pageNumber + 1 }))
    : null;

  return { self, first, last, prev, next };
}

function searchUrl (rootUrl, params) {
  return `${rootUrl}/search?${QueryString.stringify(params)}`;
}

function createMeta (params, results) {
  const total = (results.hits || {}).total || 0;
  const totalPages = Math.ceil(total / (params['page[size]'] || 50));
  // TODO: Map aggregations to filters
  return { total_pages: totalPages, filters: {} };
}

function xtend (obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}
