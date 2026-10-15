'use strict';

const buildJSONResponse = require('../../jsonapi-response');
const JSONToHTML = require('../../transforms/json-to-html-data');
const es = require('../es');
const { z } = require('./schema');
const { ToolError } = require('../errors');
const { compactRecord, compactHit } = require('../compact');
const { upward, children } = require('../hierarchy');
const { EXTERNAL_TYPES, RECORD_ID } = require('../vocab');

// Up to this many parts/children are listed inline; larger sets get a sample
// and a pointer to get_hierarchy for paging.
const INLINE_LIMIT = 50;
const SAMPLE_SIZE = 10;

const CHILD_KEYS = { objects: 'parts', group: 'members', documents: 'children' };

module.exports = {
  name: 'get_record',
  config: {
    title: 'Get a record',
    description: 'Full details of one record by id: objects (co…), people (cp… / ap…), archive documents (aa…) ' +
      'or groups (c…). Returns what the public record page shows: description, makers, dates, places, ' +
      'materials, measurements, identifiers, where it is on display, images with licence and credit, ' +
      'page views, its parent / top-level object / archive / groups, and its parts or children ' +
      `(listed in full up to ${INLINE_LIMIT}; larger sets are summarised, use get_hierarchy to page through them).`,
    inputSchema: z.object({
      id: z.string().trim().regex(RECORD_ID).describe('Record id, e.g. co8245103, cp36993, aa110000003, c83918.')
    }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  handler: async ({ id }, { elastic, config }) => {
    const raw = await es.get(elastic, id);
    if (!raw || !raw._source) throw new ToolError(`No record found with id ${id}.`);
    const source = raw._source;
    const type = EXTERNAL_TYPES[source['@datatype'] && source['@datatype'].base];
    if (!type) throw new ToolError(`${id} is not an object, person, archive document or group record.`);

    let record;
    try {
      // buildJSONResponse mutates its input, so give it a copy.
      const page = JSONToHTML(buildJSONResponse(JSON.parse(JSON.stringify(raw)), config));
      record = compactRecord(page, source);
    } catch (error) {
      console.error('MCP get_record transform failed, using summary fallback:', id, error.message);
      record = compactHit({ _source: source, _id: id }, config);
      record.notes = ['Only summary details could be prepared for this record.'];
    }

    const up = upward(id, source);
    if (Object.keys(up).length) record.belongs_to = up;

    const down = await children(elastic, config, { id, type, pageSize: INLINE_LIMIT });
    if (down.total > 0) {
      const inline = down.total <= INLINE_LIMIT;
      record[CHILD_KEYS[type]] = {
        total: down.total,
        listed: inline ? down.total : SAMPLE_SIZE,
        items: inline ? down.items : down.items.slice(0, SAMPLE_SIZE)
      };
      if (!inline) {
        record[CHILD_KEYS[type]].note = `Showing the first ${SAMPLE_SIZE} of ${down.total}. ` +
          'Use get_hierarchy to page through them, or count_records / breakdown_records with ' +
          `${type === 'group' ? 'group_id' : 'parent_id'}="${id}" to summarise them.`;
      }
    }
    return record;
  }
};
