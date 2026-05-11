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
const stripInternalNotes = require('../helpers/strip-internal-notes.js');

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
  stripInternalNotes(data);
  stripInternalNotes(included);
  return { data, included, links, meta, inProduction, mphcParent };
};

// Create resources from hits, filter any unknown resource types
function createResources (results, rootUrl, mediaPath) {
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
        included: resources.included.concat(res.included)
      };
    },
    { data: [], included: [] }
  );
}

const createResource = {
  object (hit, rootUrl, mediaPath) {
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
      'numbers',
      // 'options',
      'reference_links',
      'summary',
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
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          if (attrs[key][0]['@processed'].large_thumbnail?.location) {
            attrs[key][0]['@processed'].large_thumbnail.location =
              mediaPath + sortedImages[0]['@processed'].large_thumbnail?.location;
          }
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
      ).toLowerCase()}`
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  agent (hit, rootUrl) {
    const type = 'people';
    const id = TypeMapping.toExternal(hit._id);

    const attributes = [
      '@admin',
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
      'occupation',
      'reference_links',
      'summary',
      'title',
      'website'
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
      ).toLowerCase()}`
    };

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
      'reference_links',
      'summary',
      'title',
      'web',
      'transcriptions'
    ].reduce((attrs, key) => {
      if (hit._source && hit._source[key]) {
        attrs[key] = hit._source[key];
        // Adds image host to path
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          if (sortedImages[0]['@processed'] && sortedImages[0]['@processed'].large_thumbnail) {
            attrs[key][0]['@processed'].large_thumbnail.location =
              mediaPath + sortedImages[0]['@processed'].large_thumbnail.location;
          }
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
      ).toLowerCase()}`
    };

    return { data: { type, id, attributes, relationships, links }, included };
  },

  group (hit, rootUrl, mediaPath) {
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
      'child',
      'mphc',
      'name',
      'numbers',
      // 'options',
      'reference_links',
      'summary',
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
        if (key === 'multimedia' && hit._source.multimedia) {
          const sortedImages = sortImages(hit._source.multimedia);
          attrs[key][0]['@processed'].large_thumbnail.location =
            mediaPath + sortedImages[0]['@processed'].large_thumbnail.location;
        }
        // Adds image host to child records. Children come from related
        // collection items on a group record; not all of them have a
        // processed thumbnail (archive documents without images,
        // multimedia mid-processing, etc.) so we guard each step of the
        // path before mutating. Earlier code used a half-applied
        // optional chain on the RHS only, which still crashed because
        // the LHS evaluates `child.multimedia['@processed'].large_thumbnail`
        // before the assignment — for any child missing @processed it
        // threw "Cannot read properties of undefined (reading
        // 'large_thumbnail')" and surfaced as a misleading 503 from
        // the search route. The outer Array.isArray(...forEach()) was
        // dead — forEach returns undefined, Array.isArray(undefined)
        // is just discarded.
        // Prepend mediaPath to child-record thumbnail locations on
        // group results. Within a single group hit, `child.multimedia`
        // varies *per child*. The common shape is a single fully-
        // resolved multimedia object with `@processed.large_thumbnail.
        // location`. The previous implementation assumed every child
        // with a `multimedia` field matched that shape and mutated
        // the deep path directly. In real ES data some children carry
        // a different shape that crashed the deep mutation: an array
        // of `@entity: "reference"` stubs with only `@admin`/`uuid`
        // and no `@processed` block. Investigation showed these stubs
        // are stale denormalised references — for example the group
        // `c81835.child[4]` (object `co8056866`) carried 37 such
        // stubs pointing at media-XXX records, but the standalone
        // `co8056866` record has no multimedia at all and the media
        // records the stubs point at don't exist in ES either. Same
        // for `c81734.child[6/8]` (objects co8868118, co8838270).
        // The group document's denormalised `child` snapshot retained
        // references that have since been removed from both the
        // source objects and the media index. There's nothing to
        // resolve them to. The stubs should be ignored, not rendered.
        //
        // The previous code's deep-path mutation threw "Cannot read
        // properties of undefined (reading 'large_thumbnail')" on
        // the stub-array shape, which the search route surfaced as
        // a misleading 503 from `/search/group`. The half-applied
        // optional chain on the RHS didn't help — the LHS evaluated
        // first. The outer `Array.isArray(forEach(...))` wrapper was
        // dead — forEach returns undefined and the wrapper was a
        // no-op.
        //
        // The multimedia-shape duality (single object vs array) is
        // documented-by-convention elsewhere: `lib/helpers/get-image-
        // caption.js`, `lib/name-collections.js`, `lib/anniversary.js`
        // all normalise with `Array.isArray(m) ? m : [m]`. This
        // transform was the only place not following that convention.
        //
        // Fix: normalise to an array, iterate, and prepend mediaPath
        // only on entries that actually carry the full processed-
        // thumbnail path. Stub/orphan references are left untouched —
        // nothing to render. (If CIIM ever stops emitting these stale
        // snapshots, this code keeps working unchanged.)
        if (key === 'child' && Array.isArray(hit._source.child)) {
          hit._source.child.forEach((child) => {
            if (!child || !child.multimedia) return;
            const entries = Array.isArray(child.multimedia) ? child.multimedia : [child.multimedia];
            entries.forEach((entry) => {
              const loc = entry &&
                entry['@processed'] &&
                entry['@processed'].large_thumbnail &&
                entry['@processed'].large_thumbnail.location;
              if (loc) entry['@processed'].large_thumbnail.location = mediaPath + loc;
            });
          });
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
      ).toLowerCase()}`
    };

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
        const id = TypeMapping.toExternal(r['@admin'] && r['@admin'].uid);

        return {
          type,
          id,
          attributes: { summary_title: r.summary.title },
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

function searchUrl (type, rootUrl, params) {
  type = type ? '/' + type : '';
  delete params['fields[type]'];
  return `${rootUrl}/search${type}${paramify(params)}${querify(params)}`;
}

function createMeta (queryParams, results) {
  const total = ((results.body.hits || {}).total || {}).value || 0;
  const totalPages = Math.ceil(total / queryParams.pageSize);
  const countCategories = createCountCategories(queryParams.type, results);
  return {
    total_pages: totalPages,
    count: { type: countCategories },
    filters: createFacets(results)
  };
}

function createCountCategories (type, results) {
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

function xtend (obj1, obj2) {
  return Object.assign({}, obj1, obj2);
}
