// Strip `note` fields from JSON API output to prevent internal cataloguer
// notes (often containing staff names, e.g. "Changed from … by LUCY_ELLIS")
// from leaking out of Mimsy / AdLib via the API.
//
// Two parent keys are preserved as carve-outs because their `note` subfield
// is legitimate public content:
//   - access.note      → rendered as the "Access" row on archive pages
//   - measurements.note → catalogue context for object dimensions
const NOTE_ALLOWED_PARENTS = new Set(['access', 'measurements']);

function stripInternalNotes (value, parentKey) {
  if (Array.isArray(value)) {
    for (const item of value) stripInternalNotes(item, parentKey);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (key === 'note' && !NOTE_ALLOWED_PARENTS.has(parentKey)) {
      delete value[key];
      continue;
    }
    stripInternalNotes(value[key], key);
  }
}

module.exports = stripInternalNotes;
