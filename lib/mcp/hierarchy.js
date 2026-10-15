'use strict';

// Parent / child / group relationships, shared by get_record (inline parts)
// and get_hierarchy (paged navigation and archive arrangement).
//
// Objects and groups point at their parent through `grouping[]`:
//   SPH = component part of a single object (hidden from website search)
//   MPH = item within a multi-part record (a set, album or collection)
//   MG  = member of a curated Mimsy group (c* records)
// Archive records point at their parent through `parent[]` and at the top of
// their archive through `fonds[]`. `@hierarchy` holds the path from the
// top-level record down to this one.

const es = require('./es');
const { HIT_SOURCE, compactHit } = require('./compact');

const GRANDCHILDREN_PER_CHILD = 20;

const RELATIONSHIPS = {
  SPH: 'component part',
  MPH: 'part of a multi-part record',
  MG: 'group member'
};

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const childField = (type) => (type === 'documents' ? 'parent.@admin.uid' : 'grouping.@admin.uid');

const ref = (node) => node && node['@admin'] && node['@admin'].uid
  ? { id: node['@admin'].uid, title: (node.summary && node.summary.title) || null }
  : null;

/**
 * Everything above a record, read from its own _source (no extra queries).
 */
const upward = (id, source) => {
  const out = {};

  const parent = ref(asArray(source.parent)[0]);
  if (parent) {
    const link = asArray(source.grouping).find((g) => ref(g) && ref(g).id === parent.id);
    const linkType = link && link['@link'] && link['@link'].type;
    if (linkType && RELATIONSHIPS[linkType]) parent.relationship = `this record is a ${RELATIONSHIPS[linkType]} of it`;
    out.parent = parent;
  }

  const path = asArray(asArray(source['@hierarchy'])[0])
    .map((node) => {
      const r = ref(node);
      if (r && node.level) r.level = node.level;
      return r;
    })
    .filter((r) => r && r.id !== id);
  if (path.length) {
    out.path_from_top = path;
    out.top_level = path[0];
  }

  const fonds = ref(asArray(source.fonds)[0]);
  if (fonds && fonds.id !== id) out.archive = fonds;

  const groups = asArray(source.grouping)
    .filter((g) => g['@link'] && g['@link'].type === 'MG')
    .map(ref)
    .filter(Boolean);
  if (groups.length) out.groups = groups;

  return out;
};

const relationshipOf = (hit, parentId, type) => {
  if (type === 'documents') return 'archive child';
  const link = asArray(hit._source && hit._source.grouping)
    .find((g) => g['@admin'] && g['@admin'].uid === parentId);
  const linkType = link && link['@link'] && link['@link'].type;
  return RELATIONSHIPS[linkType] || 'child';
};

const childItem = (hit, parentId, type, config) => {
  const full = compactHit(hit, config);
  const item = { id: full.id, type: full.type, title: full.title, relationship: relationshipOf(hit, parentId, type) };
  ['date', 'level', 'on_display', 'has_image', 'thumbnail'].forEach((k) => {
    if (full[k] !== undefined && full[k] !== null) item[k] = full[k];
  });
  const identifier = asArray(hit._source && hit._source.identifier).find((i) => i.primary) ||
    asArray(hit._source && hit._source.identifier)[0];
  if (identifier && identifier.value) item.identifier = identifier.value;
  return item;
};

// How many children each of `ids` has, in one terms aggregation.
const childCounts = async (elastic, ids, type) => {
  if (!ids.length) return {};
  const field = childField(type);
  const { body } = await es.search(elastic, {
    size: 0,
    query: { terms: { [field]: ids } },
    aggs: { c: { terms: { field, include: ids, size: ids.length } } }
  });
  const counts = {};
  body.aggregations.c.buckets.forEach((b) => { counts[b.key] = b.doc_count; });
  return counts;
};

/**
 * One page of a record's children.
 * @returns {{ total, items, page, page_size }}
 */
const children = async (elastic, config, { id, type, page = 0, pageSize = 50, withChildCounts = false, depth = 1 }) => {
  const field = childField(type);
  const { body } = await es.search(elastic, {
    size: pageSize,
    from: page * pageSize,
    track_total_hits: true,
    query: { term: { [field]: id } },
    sort: [{ 'identifier.value': { order: 'asc', missing: '_last' } }, { '@admin.uid': 'asc' }],
    _source: [...HIT_SOURCE, 'grouping', 'identifier']
  });

  const items = body.hits.hits.map((hit) => childItem(hit, id, type, config));
  const ids = items.map((i) => i.id);

  if (withChildCounts || depth > 1) {
    const counts = await childCounts(elastic, ids, type);
    items.forEach((item) => { item.child_count = counts[item.id] || 0; });
  }

  if (depth > 1) {
    const withKids = items.filter((i) => i.child_count > 0).map((i) => i.id);
    if (withKids.length) {
      // One query: the first GRANDCHILDREN_PER_CHILD children of each child,
      // so one large series can't crowd out its siblings.
      const { body: grand } = await es.search(elastic, {
        size: 0,
        query: { terms: { [field]: withKids } },
        aggs: {
          by_parent: {
            terms: { field, include: withKids, size: withKids.length },
            aggs: {
              first: {
                top_hits: {
                  size: GRANDCHILDREN_PER_CHILD,
                  sort: [{ 'identifier.value': { order: 'asc', missing: '_last' } }],
                  _source: [...HIT_SOURCE, 'grouping', 'identifier']
                }
              }
            }
          }
        }
      });
      grand.aggregations.by_parent.buckets.forEach((bucket) => {
        const owner = items.find((i) => i.id === bucket.key);
        if (!owner) return;
        owner.children = bucket.first.hits.hits.map((hit) => childItem(hit, owner.id, type, config));
        if (owner.children.length < owner.child_count) owner.children_truncated = true;
      });
    }
  }

  return { total: body.hits.total.value, page, page_size: pageSize, items };
};

/**
 * Record counts by level across the archive a record belongs to.
 */
const archiveSummary = async (elastic, fondsId) => {
  const { body } = await es.search(elastic, {
    size: 0,
    track_total_hits: true,
    query: { term: { 'fonds.@admin.uid': fondsId } },
    aggs: { levels: { terms: { field: 'level.value', size: 20 } } }
  }, { heavy: true });
  const levels = {};
  body.aggregations.levels.buckets.forEach((b) => { levels[b.key] = b.doc_count; });
  return { archive_id: fondsId, records_in_archive: body.hits.total.value, by_level: levels };
};

module.exports = {
  RELATIONSHIPS,
  upward,
  children,
  childCounts,
  archiveSummary
};
