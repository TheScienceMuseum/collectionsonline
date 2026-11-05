'use strict';

// Shared flattener for sorted related-items into the shape the writer
// prompt expects. Extracted from routes/ai-biography.js + lib/ai/
// regenerate-biography.js on 2026-07-17 after a code review revealed
// two divergent implementations:
//
//   - routes/ai-biography.js used 500-char sentence-boundary truncation
//     (the correct one, added specifically to prevent the Einstein/
//     Sobral bridge-invention hallucination)
//   - lib/ai/regenerate-biography.js used 200-char word-boundary
//     truncation (the OLD behaviour). Every admin regen + every
//     bulk-generate run (including the 25K launch we're planning) was
//     going through this stale path.
//
// Now both paths import from here. See lib/ai/truncate-description.js
// for the truncation algorithm + the Sobral case-study comment
// explaining why sentence-boundary truncation matters.

const truncateDescriptionAtSentence = require('./truncate-description');
const sentencesNaming = require('./subject-mentions');

// Per related-item description size in the prompt. 500 chars ≈ 100-150
// tokens per item, so 20 items ≈ 2-3K tokens of related-item context
// in the user prompt — meaningful for the writer without dominating.
const DESCRIPTION_MAX_CHARS = 500;

function truncateDescription (text) {
  return truncateDescriptionAtSentence(text, DESCRIPTION_MAX_CHARS);
}

// The subject's role on the item for the writer: the maker role from
// creation.maker plus the role on a non-maker (`agent`) link, which
// sort-related-items attaches as `linkRole` when called with
// { forWriter: true }. Duplicates dropped, case-insensitively.
function writerRole (item) {
  const seen = new Set();
  const out = [];
  [item && item.role, item && item.linkRole].forEach(function (value) {
    String(value || '').split(',').forEach(function (part) {
      const v = part.trim();
      if (!v || seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      out.push(v);
    });
  });
  return out.join(', ');
}

// Sentences of the item's other descriptions (web description…) that name
// the subject and aren't already in what the writer sees. See
// lib/ai/subject-mentions.js.
function writerMentions (item) {
  const attrs = (item && item.attributes) || {};
  return sentencesNaming(
    item && item.otherDescriptions,
    item && item.linkName,
    [attrs.description, attrs.summary_title]
  );
}

function toWriterItem (item, type) {
  const out = {
    id: item.id,
    title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
    description: truncateDescription(item.attributes && item.attributes.description),
    link: item.links ? item.links.self : '/' + (type === 'document' ? 'documents' : 'objects') + '/' + item.id,
    type,
    role: writerRole(item)
  };
  const mentions = writerMentions(item);
  if (mentions.length) out.catalogueMentions = mentions;
  return out;
}

// Flatten sortedRelated (from lib/sort-related-items) into the writer's
// preferred item shape. Objects and documents get distinct `link`
// prefixes but identical shape otherwise.
function flattenRelated (sortedRelated) {
  const items = [];
  const objects = (sortedRelated && sortedRelated.relatedObjects) || [];
  const documents = (sortedRelated && sortedRelated.relatedDocuments) || [];

  objects.forEach(function (item) {
    items.push(toWriterItem(item, 'object'));
  });

  documents.forEach(function (item) {
    items.push(toWriterItem(item, 'document'));
  });

  return items;
}

module.exports = flattenRelated;
module.exports.DESCRIPTION_MAX_CHARS = DESCRIPTION_MAX_CHARS;
module.exports.truncateDescription = truncateDescription;
module.exports.writerRole = writerRole;
module.exports.writerMentions = writerMentions;
