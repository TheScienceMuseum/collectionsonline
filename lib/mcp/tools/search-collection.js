'use strict';

const search = require('../../search');
const es = require('../es');
const { z, filters } = require('./schema');
const { buildFilter } = require('../query/filters');
const { searchParams, NO_MATCH_HINT } = require('../query/run');
const { HIT_SOURCE, compactHit } = require('../compact');
const { childCounts } = require('../hierarchy');
const { TYPE_NAMES } = require('../vocab');

const SORTS = {
  relevance: null,
  most_viewed: [{ 'enhancement.analytics.current.cumulative_views': { order: 'desc', missing: '_last' } }, '_score'],
  recently_added: [{ '@admin.added': 'desc' }],
  recently_republished: [{ '@admin.processed': 'desc' }],
  date_made_oldest: [{ 'creation.date.from': { order: 'asc', missing: '_last' } }],
  date_made_newest: [{ 'creation.date.from': { order: 'desc', missing: '_last' } }]
};

module.exports = {
  name: 'search_collection',
  config: {
    title: 'Search the collection',
    description: 'Find objects, people, archive documents and groups. Free text (q) is ranked like the website ' +
      'search; any filters narrow the results. sort=most_viewed gives the most popular records (lifetime ' +
      'website page views). Each result has a short summary, where it is on display, image licence, page views ' +
      'and parts_count when the record has parts or children. Use get_record for full details.',
    inputSchema: z.object({
      type: z.enum(TYPE_NAMES).optional().describe('Record type (default all = objects + people + documents).'),
      sort: z.enum(Object.keys(SORTS)).optional().describe('Default relevance (or website ranking when there is no q).'),
      page: z.number().int().min(0).max(20).optional().describe('Page number, from 0.'),
      page_size: z.number().int().min(1).max(25).optional().describe('Results per page (default 10, max 25).'),
      ...filters
    }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async (args, { elastic, config }) => {
    const { query, applied } = buildFilter(args);
    const page = args.page || 0;
    const pageSize = args.page_size || 10;
    const sort = args.sort || 'relevance';
    const qp = searchParams(args.q, args.type, page, pageSize);

    const res = await es.guarded(() => search(elastic, qp, {
      aggs: {},
      postFilter: query,
      trackTotalHits: true,
      sort: SORTS[sort] || undefined,
      source: HIT_SOURCE,
      timeout: es.TIMEOUT,
      requestTimeout: es.REQUEST_TIMEOUT
    }));

    const results = res.body.hits.hits.map((hit) => compactHit(hit, config));

    // parts_count / child counts, one small aggregation per record type present.
    for (const kind of ['objects', 'documents', 'group']) {
      const ids = results.filter((r) => r.type === kind).map((r) => r.id);
      if (!ids.length) continue;
      const counts = await childCounts(elastic, ids, kind);
      results.filter((r) => r.type === kind && counts[r.id]).forEach((r) => {
        r[kind === 'documents' ? 'child_count' : 'parts_count'] = counts[r.id];
      });
    }

    const total = res.body.hits.total.value;
    const out = { total, page, page_size: pageSize, sort, results, filters_applied: { ...applied, q: qp.q || undefined } };
    if (!res.exact) out.exact = false;
    if (total === 0) out.notes = [NO_MATCH_HINT];
    return out;
  }
};
