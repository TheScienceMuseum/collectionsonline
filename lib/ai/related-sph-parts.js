'use strict';

// SPH-part items for the AI biography writer's collection-items list.
//
// lib/get-related-items.js excludes Single-Part Hierarchy children
// ("parts") because /objects/{partId} redirects to the parent — right for
// the public "Related objects" panel, but it means a person credited ONLY
// on a part never reaches the writer. Murray, Sons & Co (cp136345) is
// credited on one set of cigarette cards (co8339712) inside a parent
// record (co532218) that carries no maker at all, so the bio had nothing
// to cite and no "In the collection" block.
//
// This module fetches the person's linked parts and turns them into
// writer items keyed on the PARENT's id, so `{coXXXX|…}` markers and
// `relatedItem:coXXXX` citations resolve to a real page. Each item keeps
// the part's own title and description (that is what the person is
// credited on) plus a short "part of <parent>" note so the writer
// describes it accurately. AI pipeline only — the public panel still
// calls getRelatedItems with its default behaviour.

const config = require('../../config');
const TypeMapping = require('../type-mapping');
const searchWeights = require('../search-weights');
const sortRelated = require('../sort-related-items');
const { truncateDescription } = require('./flatten-related');

// Only what sortRelated + the collapse read. Parts can carry large
// multimedia blocks the writer never sees.
const SOURCE_FIELDS = [
  '@datatype',
  'summary',
  'title',
  'description',
  'grouping',
  'creation.maker',
  'agents',
  'level',
  'identifier'
];

// How many sibling part titles to name in the "part of" note before
// summarising the rest as "and N more".
const MAX_OTHER_PART_TITLES = 5;

async function fetchSphPartHits (elastic, id, size) {
  const uid = TypeMapping.toInternal(id);
  const result = await elastic.search({
    index: config.elasticIndex,
    body: {
      size,
      _source: SOURCE_FIELDS,
      query: {
        function_score: {
          query: {
            bool: {
              // Same person match as lib/get-related-items.js.
              should: [
                { match: { 'creation.maker.@admin.uid': uid } },
                { match: { 'agent.@admin.uid': uid } }
              ],
              minimum_should_match: 1,
              filter: [
                { term: { 'grouping.@link.type': 'SPH' } },
                { term: { '@datatype.base': 'object' } }
              ]
            }
          },
          functions: searchWeights()
        }
      }
    }
  }, { requestTimeout: 2000 });
  return result.body.hits.hits;
}

// The SPH grouping entry on a part carries the parent's uid and title —
// the same parent routes/object.js redirects /objects/{partId} to.
function sphParent (hit) {
  const grouping = (hit && hit._source && hit._source.grouping) || [];
  const entry = (Array.isArray(grouping) ? grouping : []).find(function (g) {
    return g && g['@link'] && g['@link'].type === 'SPH';
  });
  const uid = entry && entry['@admin'] && entry['@admin'].uid;
  if (!uid) return null;
  return {
    id: TypeMapping.toExternal(uid),
    title: (entry.summary && entry.summary.title) || ''
  };
}

function partOfNote (parentTitle, otherTitles) {
  let note = parentTitle
    ? '(Catalogued as a part of "' + parentTitle + '"; the ID links to that parent record.'
    : '(Catalogued as a part of a larger record; the ID links to that parent record.';
  if (otherTitles.length) {
    const named = otherTitles.slice(0, MAX_OTHER_PART_TITLES).map(function (t) { return '"' + t + '"'; });
    const more = otherTitles.length - named.length;
    note += ' Other credited parts of the same record: ' + named.join('; ') +
      (more > 0 ? ' and ' + more + ' more' : '') + '.';
  }
  return note + ')';
}

function partTitle (part) {
  return (part.attributes && part.attributes.summary_title) || '';
}

// Collapse part hits (ES order = rank order) to one writer item per
// parent. Parents in `opts.excludeIds` — typically the person's linked
// whole objects, the common case — are dropped so nothing is listed
// twice. The lead (highest-ranked) part supplies title, description and
// role; the parent title stands in when the part has no title of its own.
function collapseSphParts (partHits, personId, opts) {
  opts = opts || {};
  const exclude = new Set((opts.excludeIds || []).map(function (i) { return String(i).toLowerCase(); }));

  const hitsById = Object.create(null);
  (partHits || []).forEach(function (h) {
    if (h && h._id) hitsById[TypeMapping.toExternal(h._id)] = h;
  });

  // sortRelated gives the same id / title / description / role
  // extraction whole objects get, in hit order.
  const parts = sortRelated(partHits || [], personId).relatedObjects;

  const byParent = new Map();
  parts.forEach(function (part) {
    const parent = sphParent(hitsById[part.id]);
    if (!parent) return;
    const key = parent.id.toLowerCase();
    if (exclude.has(key)) return;
    if (!byParent.has(key)) byParent.set(key, { parent, parts: [] });
    byParent.get(key).parts.push(part);
  });

  return Array.from(byParent.values()).map(function (group) {
    const lead = group.parts[0];
    const others = group.parts.slice(1).map(partTitle).filter(Boolean);
    const description = truncateDescription(lead.attributes && lead.attributes.description);
    const note = partOfNote(group.parent.title, others);
    const withRole = group.parts.find(function (p) { return p.role; });
    return {
      id: group.parent.id,
      title: partTitle(lead) || group.parent.title,
      description: description ? description + ' ' + note : note,
      link: '/objects/' + group.parent.id,
      type: 'object',
      role: (withRole && withRole.role) || '',
      partIds: group.parts.map(function (p) { return p.id; })
    };
  });
}

// Append part-derived items after the whole-object items, filling only
// the slots left under `cap`. Skips the ES call when whole objects
// already fill the list. Throws on ES failure — the caller decides
// whether that's fatal.
async function appendSphPartItems (elastic, id, wholeItems, cap) {
  const room = cap - wholeItems.length;
  if (room <= 0) return wholeItems;
  const hits = await fetchSphPartHits(elastic, id, cap);
  const items = collapseSphParts(hits, id, {
    excludeIds: wholeItems.map(function (i) { return i.id; })
  });
  return wholeItems.concat(items.slice(0, room));
}

module.exports = appendSphPartItems;
module.exports.fetchSphPartHits = fetchSphPartHits;
module.exports.collapseSphParts = collapseSphParts;
module.exports.sphParent = sphParent;
