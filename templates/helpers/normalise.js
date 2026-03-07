// Name transposition ("Last, First" → "First Last") was previously handled here
// for Mimsy people records. It is now handled upstream in getValues.getTitle(),
// which returns a display-ready name for all sources (Mimsy and AdLib).
// This helper is kept as a pass-through so existing template call-sites remain
// valid without changes.
module.exports = function normaliseName (name) {
  return name;
};
