'use strict';

const { z, type, filters } = require('./schema');
const { runAggregation } = require('../query/run');
const { EXTERNAL_TYPES } = require('../vocab');

module.exports = {
  name: 'count_records',
  config: {
    title: 'Count records',
    description: 'Exact number of records matching a set of filters, e.g. how many objects have an image, ' +
      'how many are licensed CC BY-NC-SA 4.0, how many are on display at the National Railway Museum, ' +
      'how many records were added online last month (added_from="now-1M/M", added_to="now-1M/M"). ' +
      'All filters combine with AND. With type "all" the result is also split by type. ' +
      'Component parts of objects are excluded unless include_component_parts is true.',
    inputSchema: z.object({ type, ...filters }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async (args, { elastic }) => {
    const aggs = args.type === 'all'
      ? { by_type: { terms: { field: '@datatype.base', size: 10 } } }
      : {};
    const { total, aggs: result, exact, applied, notes } = await runAggregation(elastic, args, aggs);
    const out = { total, exact, filters_applied: applied };
    if (result.by_type) {
      out.by_type = {};
      result.by_type.buckets.forEach((b) => { out.by_type[EXTERNAL_TYPES[b.key] || b.key] = b.doc_count; });
    }
    if (notes.length) out.notes = notes;
    return out;
  }
};
