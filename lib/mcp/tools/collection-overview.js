'use strict';

const es = require('../es');
const { z } = require('./schema');
const { FILTER_FIELDS } = require('../query/filters');
const { DIMENSIONS, parseAggs } = require('../query/dimensions');
const { EXTERNAL_TYPES, MUSEUMS } = require('../vocab');

// The overview scans the whole index; agents tend to call it at the start of
// a conversation, so keep the answer for an hour.
const TTL_MS = 60 * 60 * 1000;
let cached = null;

const NO_PARTS = { bool: { must_not: [{ term: { 'grouping.@link.type': 'SPH' } }] } };
const byType = { terms: { field: '@datatype.base', size: 10 } };

const DEFINITIONS = {
  objects: 'Catalogued museum objects. Component parts of an object (e.g. the lever of an engine) are separate records but hidden from website search and excluded from counts unless include_component_parts=true.',
  people: 'People and organisations (makers, users, subjects).',
  documents: 'Archive records arranged fonds → series → file → item.',
  group: 'Curated Mimsy groups of objects; few exist and they are not prominent on the website.',
  has_image: 'At least one image is published online.',
  image_licence: 'A record counts for a licence when at least one of its images carries it.',
  on_display: 'Currently on display in a museum gallery; everything else is in store.',
  decades: 'Decade and century breakdowns group each record by the start year of its date range; year filters (made_from/made_to) only count records whose whole range falls inside, so the two can differ.',
  added: 'Date the record was first published to the online catalogue.',
  republished: 'Date the record was last re-published online. This follows catalogue edits but also bulk reprocessing, so it is not strictly the last edit date.',
  page_views: 'Lifetime page views of the record on the website (since Aug 2015). Used for "most popular".'
};

const query = async (elastic) => {
  const { body } = await es.search(elastic, {
    size: 0,
    track_total_hits: true,
    query: { terms: { '@datatype.base': ['object', 'agent', 'archive', 'group'] } },
    aggs: {
      all: byType,
      no_parts: { filter: NO_PARTS, aggs: { by_type: byType } },
      with_images: {
        filter: { bool: { filter: [{ exists: { field: FILTER_FIELDS.image } }], must_not: NO_PARTS.bool.must_not } },
        aggs: { by_type: byType }
      },
      licences: { filter: NO_PARTS, aggs: { values: { terms: { field: FILTER_FIELDS.licence, size: 20 } } } },
      images_without_licence: {
        filter: {
          bool: {
            filter: [{ exists: { field: FILTER_FIELDS.image } }],
            must_not: [...NO_PARTS.bool.must_not, { exists: { field: FILTER_FIELDS.licence } }]
          }
        }
      },
      display: { filter: NO_PARTS, aggs: { values: { terms: { field: FILTER_FIELDS.onDisplay, size: 500 } } } },
      on_display: {
        filter: { bool: { filter: [{ exists: { field: FILTER_FIELDS.onDisplay } }], must_not: NO_PARTS.bool.must_not } }
      },
      people: { filter: { term: { '@datatype.base': 'agent' } }, aggs: { kinds: { terms: { field: '@datatype.actual', size: 5 } } } },
      archive_levels: { filter: { term: { '@datatype.base': 'archive' } }, aggs: { levels: { terms: { field: 'level.value', size: 10 } } } },
      added_30d: { filter: { range: { '@admin.added': { gte: 'now-30d' } } } },
      republished_30d: { filter: { range: { '@admin.processed': { gte: 'now-30d' } } } },
      latest: { max: { field: '@admin.processed' } }
    }
  }, { heavy: true });

  const a = body.aggregations;
  const typeCounts = (agg) => {
    const out = {};
    agg.buckets.forEach((b) => { out[EXTERNAL_TYPES[b.key] || b.key] = b.doc_count; });
    return out;
  };
  const all = typeCounts(a.all);
  const noParts = typeCounts(a.no_parts.by_type);

  const museums = parseAggs('museum', { dim: a.display.values }, { limit: 20 }).buckets;
  const galleries = parseAggs('gallery', { dim: a.display.values }, { limit: 200 }).buckets;

  const levels = {};
  a.archive_levels.levels.buckets.forEach((b) => { levels[b.key] = b.doc_count; });
  const kinds = {};
  a.people.kinds.buckets.forEach((b) => { kinds[b.key] = b.doc_count; });
  // AdLib people records don't say whether they're a person or organisation.
  kinds.not_recorded = a.people.doc_count - Object.values(kinds).reduce((sum, n) => sum + n, 0);

  return {
    as_of: a.latest.value ? new Date(a.latest.value).toISOString() : null,
    totals: {
      objects: noParts.objects,
      object_component_parts: (all.objects || 0) - (noParts.objects || 0),
      people: all.people,
      people_by_kind: kinds,
      documents: all.documents,
      documents_by_level: levels,
      group: all.group
    },
    with_images: typeCounts(a.with_images.by_type),
    image_licences: {
      by_licence: a.licences.values.buckets.map((b) => ({ value: b.key, count: b.doc_count })),
      records_with_images_but_no_licence: a.images_without_licence.doc_count
    },
    on_display: {
      total_objects: a.on_display.doc_count,
      by_museum: museums,
      galleries
    },
    recent_activity: {
      added_online_last_30_days: a.added_30d.doc_count,
      republished_last_30_days: a.republished_30d.doc_count
    },
    vocabulary: {
      museums: MUSEUMS.map((m) => m.name),
      group_by: DIMENSIONS,
      record_id_prefixes: { co: 'object', cp: 'person (Mimsy)', ap: 'person (AdLib)', aa: 'archive document', c: 'group' }
    },
    definitions: DEFINITIONS
  };
};

module.exports = {
  name: 'get_collection_overview',
  config: {
    title: 'Collection overview',
    description: 'A snapshot of the whole public collection: totals by type, images and licences, objects on ' +
      'display by museum and gallery, archive levels, recent publishing activity, the museum names and ' +
      'group_by dimensions the other tools accept, and definitions of the terms used. A good first call.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async (args, { elastic }) => {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    const value = await query(elastic);
    cached = { at: Date.now(), value };
    return value;
  },
  _reset: () => { cached = null; }
};
