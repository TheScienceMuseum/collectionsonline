/**
 * Build a JSONAPI formated object
 */

const TypeMapping = require('../type-mapping');
const createFacets = require('../facets/create-facets');
const checkPurchased = require('../check-purchased');
const paramify = require('../helpers/paramify.js');
const querify = require('../helpers/querify.js');
const slug = require('slugg');
const sortImages = require('../helpers/jsonapi-response/sort-images.js');

module.exports = (queryParams, results, config, mphcParent) => {
  results = results || {};
  config = config || {};
  const rootUrl = config.rootUrl || '';
  const mediaPath = config.mediaPath || '';
  const resources = createResources(results, rootUrl, mediaPath);
  const data = resources.data;
  const included = resources.included;
  const links = createLinks(queryParams, results, rootUrl);
  const meta = createMeta(queryParams, results);
  const inProduction = config && config.NODE_ENV === 'production';
  return { data, included, links, meta, inProduction, mphcParent };
};

// Create resources from hits, filter any unknown resource types
function createResources(results, rootUrl, mediaPath) {
  const hits = (results.body.hits || {}).hits || [];
  return hits.reduce(
    (resources, hit) => {
      // Create a resource if a creator exists for the hit._type
      const creator = createResource[hit._source['@datatype'].base];

      if (!creator) {
        console.warn(`No resource creator for hit ${hit._id}`);
        return resources;
      }

      const res = creator(hit, rootUrl, mediaPath);
      return {
        data: resources.data.concat(res.data),
        included: resources.included.concat(res.included),
      };
    },
    { data: [], included: [] }
  );
}

const createResource = {
  object(hit, rootUrl, mediaPath) {
    const type = 'objects';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      '@admin',
      'arrangement',
      'autocomplete',
      'birth',
      'category',
      'collection',
      'component',
      'condition',
      'creation',
      'custodial_history',
      'cumulation',
      'dates',
      'death',
      'description',
      'identifier',
      'inscription',
      'language',
      'legal',
      'locations',
      'materials',
      'measurements',
      'multimedia',
      'mphc',
      'name',
      'note',
      'numbers',
      // 'options',
      'reference_links',
      'summary',
      'title',
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
        // temporary - restrict credit line if it contains 'Purchased'
        // https://github.com/TheScienceMuseum/collectionsonline/issues/195
        if (key === 'legal' && checkPurchased(attrs, key)) {
          delete attrs[key].credit_line;
        }
        // Adds image host to path
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          attrs[key][0]['@processed'].large_thumbnail.location =
            mediaPath + sortedImages[0]['@processed'].large_thumbnail.location;
        }
      }
      return attrs;
    }, {});

    const rels = createRelationships(
      hit,
      ['agent', 'cultures', 'events', 'parent', 'place', 'terms'],
      rootUrl
    );

    const relationships = rels.relationships;
    const included = rels.included;
    const links = {
      self: `${rootUrl}/objects/${id}/${slug(
        attributes.summary.title
      ).toLowerCase()}`,
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  agent(hit, rootUrl) {
    const type = 'people';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      'admin',
      'birth',
      'death',
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
      'summary',
      'title',
      'website',
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
      }
      return attrs;
    }, {});

    const rels = createRelationships(
      hit,
      ['agents', 'places', 'terms'],
      rootUrl
    );

    const relationships = rels.relationships;
    const included = rels.included;
    const links = {
      self: `${rootUrl}/people/${id}/${slug(
        attributes.summary.title
      ).toLowerCase()}`,
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  archive(hit, rootUrl, mediaPath) {
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
      'summary',
      'title',
      'web',
      'transcriptions',
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
        // Adds image host to path
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          attrs[key][0]['@processed'].large_thumbnail.location =
            mediaPath + sortedImages[0]['@processed'].large_thumbnail.location;
        }
      }
      return attrs;
    }, {});

    const rels = createRelationships(
      hit,
      ['agents', 'archives', 'fonds', 'organisations', 'parent'],
      rootUrl
    );

    const relationships = rels.relationships;
    const included = rels.included;
    const links = {
      self: `${rootUrl}/documents/${id}/${slug(
        attributes.summary.title
      ).toLowerCase()}`,
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  group(hit, rootUrl, mediaPath) {
    const type = 'group';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      '@admin',
      'arrangement',
      'autocomplete',
      'birth',
      'category',
      'collection',
      'component',
      'condition',
      'creation',
      'custodial_history',
      'cumulation',
      'dates',
      'death',
      'description',
      'identifier',
      'inscription',
      'language',
      'legal',
      'locations',
      'materials',
      'measurements',
      'multimedia',
      'mphc',
      'name',
      'note',
      'numbers',
      // 'options',
      'reference_links',
      'summary',
      'title',
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
        // temporary - restrict credit line if it contains 'Purchased'
        // https://github.com/TheScienceMuseum/collectionsonline/issues/195
        if (key === 'legal' && checkPurchased(attrs, key)) {
          delete attrs[key].credit_line;
        }
        // Adds image host to path
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          attrs[key][0]['@processed'].large_thumbnail.location =
            mediaPath + sortedImages[0]['@processed'].large_thumbnail.location;
        }
      }
      return attrs;
    }, {});

    const rels = createRelationships(
      hit,
      ['agent', 'cultures', 'events', 'parent', 'place', 'terms'],
      rootUrl
    );

    const relationships = rels.relationships;
    const included = rels.included;
    const links = {
      self: `${rootUrl}/group/${id}/${slug(
        attributes.summary.title
      ).toLowerCase()}`,
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },
};

function createRelationships(hit, props, rootUrl) {
  // Reference relationships
  const relationships = props.reduce((rels, key) => {
    if (hit._source && hit._source[key] && hit._source[key].length) {
      const type = TypeMapping.toExternal(key);

      rels[type] = {
        data: hit._source[key].map((r) => {
          const id = TypeMapping.toExternal(r.admin && r.admin.uid);
          return { type, id };
        }),
      };
    }
    return rels;
  }, {});

  // Add included docs
  const included = props.reduce((incs, key) => {
    if (hit._source && hit._source[key] && hit._source[key].length) {
      const type = TypeMapping.toExternal(key);

      const resources = hit._source[key].map((r) => {
        const id = TypeMapping.toExternal(r['@admin'] && r['@admin'].uid);

        return {
          type,
          id,
          attributes: { summary_title: r.summary.title },
          links: { self: `${rootUrl}/${type}/${id}` },
        };
      });

      incs = incs.concat(resources);
    }
    return incs;
  }, []);

  return { relationships, included };
}

// Creates a top level links object
function createLinks(queryParams, results, rootUrl) {
  const totalPages = Math.ceil(
    results.body.hits.total.value / queryParams.pageSize
  );
  const pageNumber = queryParams.pageNumber;
  const type = queryParams.type !== 'all' ? queryParams.type : null;
  const self = searchUrl(type, rootUrl, queryParams.query);
  const first = searchUrl(
    type,
    rootUrl,
    xtend(queryParams.query, { 'page[number]': 0 })
  );
  const last = searchUrl(
    type,
    rootUrl,
    xtend(queryParams.query, { 'page[number]': totalPages - 1 })
  );
  const prev =
    pageNumber > 0
      ? searchUrl(
          type,
          rootUrl,
          xtend(queryParams.query, { 'page[number]': pageNumber - 1 })
        )
      : null;
  const next =
    pageNumber < totalPages - 1
      ? searchUrl(
          type,
          rootUrl,
          xtend(queryParams.query, { 'page[number]': pageNumber + 1 })
        )
      : null;

  return { self, first, last, prev, next };
}

function searchUrl(type, rootUrl, params) {
  type = type ? '/' + type : '';
  delete params['fields[type]'];
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function createMeta(queryParams, results) {
  const total = ((results.body.hits || {}).total || {}).value || 0;
  const totalPages = Math.ceil(total / queryParams.pageSize);
  const countCategories = createCountCategories(queryParams.type, results);
  return {
    total_pages: totalPages,
    count: { type: countCategories },
    filters: createFacets(results),
  };
}

function createCountCategories(type, results) {
  const result = { all: 0, people: 0, objects: 0, documents: 0, group: 0 };
  const aggs = results.body.aggregations.total_categories;
  const numbers = { all: 0, people: 0, objects: 0, documents: 0, group: 0 };
  if (type !== 'all') {
    numbers.people = aggs.people.people_total.value;
    numbers.objects = aggs.objects.objects_total.value;
    numbers.documents = aggs.documents.documents_total.value;
    numbers.group = aggs.group.group_total.value;
    numbers.all =
      numbers.people + numbers.objects + numbers.documents + numbers.group;
  } else {
    numbers.all = aggs.all.doc_count;
    const buckets = aggs.all.all_total.buckets;
    buckets.forEach((bucket) => {
      numbers[TypeMapping.toExternal(bucket.key)] = bucket.doc_count;
    });
  }

  result.all += numbers.all ? numbers.all : 0;
  result.people += numbers.people ? numbers.people : 0;
  result.objects += numbers.objects ? numbers.objects : 0;
  result.documents += numbers.documents ? numbers.documents : 0;
  result.group += numbers.group ? numbers.group : 0;
  return result;
}

function xtend(obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}
