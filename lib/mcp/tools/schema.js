'use strict';

// Input schemas shared by the MCP tools. Kept flat and primitive (strings,
// numbers, booleans, enums) because Copilot Studio's orchestrator handles
// those far more reliably than nested objects.

const z = require('zod');
const { TYPE_NAMES, MUSEUM_NAMES } = require('../vocab');

const text = (description) => z.string().trim().min(1).max(200).optional().describe(description);
const year = (description) => z.number().int().min(0).max(2100).optional().describe(description);
const date = (description) => z.string().trim().max(40).optional().describe(description);

const type = z.enum(TYPE_NAMES).describe(
  'Record type: objects, people (people and organisations), documents (archive records), ' +
  'group (curated Mimsy groups, rarely used) or all (objects + people + documents).'
);

const filters = {
  q: text('Free-text search, ranked like the website search. Optional; combine with any filter.'),
  museum: text(`Only records currently on display at this museum: ${MUSEUM_NAMES.join(', ')}. Short codes scm, nrm, sim, nsmm accepted.`),
  gallery: text('Only records on display in this gallery, e.g. "Flight Gallery". Exact name; list names with breakdown_records group_by=gallery.'),
  on_display: z.boolean().optional().describe('true = currently on display at any museum; false = not on display (in store).'),
  has_image: z.boolean().optional().describe('true = has at least one image online; false = no image.'),
  image_licence: text('Image licence, e.g. "CC BY-NC-SA 4.0", "CC BY-NC-ND 4.0", "Open Government Licence v3.0". "none" = has images but no licence recorded; "any" = any licence.'),
  category: text('Collection category, e.g. "Space Technology", "Photographic Technology". Exact name.'),
  collection: text('Named collection the object came from, e.g. "Daily Herald Archive". Exact name.'),
  maker: text('Maker / creator name as catalogued, e.g. "Babbage, Charles" or "Amersham International plc". Exact name.'),
  place_made: text('Place where made, e.g. "London". Exact name.'),
  object_type: text('Object name / type, e.g. "camera", "locomotive". Exact name.'),
  material: text('Material, e.g. "brass", "glass". Exact name.'),
  archive: text('Archive (fonds) title, e.g. "Babbage Papers". Exact title.'),
  archive_id: text('Archive (fonds) record id, e.g. "aa110000003". Every record within that archive.'),
  level: text('Archive level: fonds, series, sub-series, file or item.'),
  parent_id: text('Only the direct children of this record id: parts of an object, or the next level down in an archive.'),
  group_id: text('Only members of this group record id (c…).'),
  occupation: text('Occupation of a person, e.g. "photographer". Exact value.'),
  birth_place: text('Place of birth (people) or base (organisations). Exact name.'),
  person_or_organisation: z.enum(['person', 'organisation']).optional().describe('People records only: individuals or organisations.'),
  made_from: year('Made in or after this year (objects and documents). The whole date range must fall inside made_from–made_to.'),
  made_to: year('Made in or before this year (objects and documents).'),
  born_from: year('Born / founded in or after this year (people).'),
  born_to: year('Born / founded in or before this year (people).'),
  added_from: date('First published online on or after: YYYY, YYYY-MM, YYYY-MM-DD, or date math such as now-1M/M (start of last month).'),
  added_to: date('First published online on or before (inclusive): YYYY, YYYY-MM, YYYY-MM-DD, or date math such as now-1M/M (end of last month).'),
  republished_from: date('Last re-published to the online catalogue on or after. Re-publishing follows catalogue edits but also bulk reprocessing, so it is not strictly "last edited".'),
  republished_to: date('Last re-published on or before (inclusive). Same formats as republished_from.'),
  include_component_parts: z.boolean().optional().describe(
    'Include component parts of single objects (hidden from the website search). Default false, except with parent_id or group_id where parts are included.'
  )
};

module.exports = { z, type, filters };
