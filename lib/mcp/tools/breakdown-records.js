'use strict';

const { z, type, filters } = require('./schema');
const { runAggregation } = require('../query/run');
const { DIMENSIONS, DATE_DIMENSIONS, buildAggs, parseAggs } = require('../query/dimensions');

module.exports = {
  name: 'breakdown_records',
  config: {
    title: 'Break down records by a field',
    description: 'Exact record counts grouped by one dimension, within any filters: e.g. objects on display ' +
      'per museum, top categories in the Science Museum, licences of objects with images, records added ' +
      'online per month, objects made per decade. Also use it to find exact filter values: set match to a ' +
      'word (case-insensitive) to list matching values with counts, e.g. group_by="gallery", match="flight". ' +
      'A record with several values (e.g. several makers) counts once per value. Date dimensions return ' +
      'every period in order and ignore limit.',
    inputSchema: z.object({
      type,
      group_by: z.enum(DIMENSIONS).describe('The field to group by.'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum buckets to return (default 20, highest counts first).'),
      match: z.string().trim().min(1).max(50).optional().describe('Only values containing this text (case-insensitive).'),
      ...filters
    }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async (args, { elastic }) => {
    const opts = { limit: args.limit || 20, match: args.match };
    const { total, aggs, exact, applied, notes } = await runAggregation(elastic, args, buildAggs(args.group_by, opts));
    const parsed = parseAggs(args.group_by, aggs, opts);
    const out = {
      group_by: args.group_by,
      total_records: total,
      buckets: parsed.buckets,
      exact: exact && parsed.exact,
      filters_applied: applied
    };
    if (parsed.other_values_count !== undefined && !DATE_DIMENSIONS.includes(args.group_by)) {
      out.other_values_count = parsed.other_values_count;
    }
    if (parsed.records_without_value !== undefined) out.records_without_value = parsed.records_without_value;
    if (parsed.error_bound) out.count_error_bound = parsed.error_bound;
    if (args.match) out.match = args.match;
    const allNotes = [...notes];
    if (parsed.notes) allNotes.push(parsed.notes);
    if (allNotes.length) out.notes = allNotes;
    return out;
  }
};
