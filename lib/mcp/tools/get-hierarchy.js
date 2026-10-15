'use strict';

const es = require('../es');
const { z } = require('./schema');
const { ToolError } = require('../errors');
const { upward, children, archiveSummary } = require('../hierarchy');
const { EXTERNAL_TYPES, RECORD_ID } = require('../vocab');

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

module.exports = {
  name: 'get_hierarchy',
  config: {
    title: 'Navigate parts, groups and archives',
    description: 'Where a record sits in the collection structure. Up: its direct parent, the top-level ' +
      '(whole) object or fonds, the archive it belongs to, and the groups it is a member of. Down: a page of ' +
      'its parts, members or archive children, each with its own child count; depth=2 also lists the next ' +
      'level (useful for archive series → files). For archive records it also counts every record in the ' +
      'archive by level. Use it for "what parts make up this object", "what is this part of", "what is in ' +
      'this archive", "which group is this in".',
    inputSchema: z.object({
      id: z.string().trim().regex(RECORD_ID).describe('Record id, e.g. co50985, co52156, aa110000003, c83918.'),
      page: z.number().int().min(0).max(200).optional().describe('Page of children, from 0.'),
      page_size: z.number().int().min(1).max(50).optional().describe('Children per page (default 25, max 50).'),
      depth: z.number().int().min(1).max(2).optional().describe('1 (default) = direct children; 2 = also their children (up to 200).')
    }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async ({ id, page = 0, page_size: pageSize = 25, depth = 1 }, { elastic, config }) => {
    const raw = await es.get(elastic, id);
    if (!raw || !raw._source) throw new ToolError(`No record found with id ${id}.`);
    const source = raw._source;
    const type = EXTERNAL_TYPES[source['@datatype'] && source['@datatype'].base];
    if (!type) throw new ToolError(`${id} is not an object, person, archive document or group record.`);

    const out = {
      id,
      type,
      title: (source.summary && source.summary.title) || null
    };
    if (source.level && source.level.value) out.level = source.level.value;

    if (type === 'people') {
      out.notes = ['People records have no parts or parent. Use search_collection with maker="<name>" to find their objects.'];
      return out;
    }

    Object.assign(out, upward(id, source));
    out.children = await children(elastic, config, { id, type, page, pageSize, withChildCounts: true, depth });

    if (type === 'documents') {
      const fonds = asArray(source.fonds)[0];
      const fondsId = (source.level && source.level.value === 'fonds')
        ? id
        : fonds && fonds['@admin'] && fonds['@admin'].uid;
      if (fondsId) out.archive_summary = await archiveSummary(elastic, fondsId);
    }
    return out;
  }
};
