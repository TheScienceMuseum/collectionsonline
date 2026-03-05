'use strict';

/**
 * wikiPropertySort.js
 *
 * Sorts and merges the value arrays for individual Wikidata properties before
 * they are sent to the template. Keeps the template logic simple and allows
 * the behaviour to be unit-tested independently.
 *
 * Rules applied per property (in priority order):
 *
 *   DATED entries  — items whose value string ends with a year or year-range
 *                    in parentheses, e.g. "ETH Zurich (1928-1940)" or
 *                    "Physicist (2005)".
 *
 *   1. Merge  — identical base labels whose year spans overlap or are
 *               adjacent (gap ≤ 1 year) are collapsed into a single entry
 *               that spans the combined range.
 *               e.g. "CEO (1995-1997)" + "CEO (1997-2011)" → "CEO (1995-2011)"
 *               Non-adjacent spans for the same label are kept separate.
 *               e.g. "Larry Page (1998-2001)" + "Larry Page (2011-2015)" stay split.
 *
 *   2. Sort   — merged dated entries are sorted by start year ASC, then
 *               alphabetically within the same start year.
 *
 *   UNDATED entries — items with no year brackets.
 *
 *   3. Sort   — if item count ≤ THRESHOLD sort purely alphabetically.
 *               if item count  > THRESHOLD put linked items (those with a
 *               `related` URL or `searchUrl`) first (alphabetically), then
 *               unlinked items (alphabetically).  This highlights available
 *               links without disrupting short alphabetical lists.
 *
 *   MIXED     — if a property has both dated and undated entries, dated items
 *               are sorted/merged and placed first; undated items are appended
 *               in alphabetical order.
 */

/**
 * Number of items to show before the "Show more" button appears in the UI.
 * Used server-side to decide whether to promote linked items (rule 3) and
 * exported so the client-side wiki-more listener can use the same value.
 */
const THRESHOLD = 5;

/**
 * Parse a year or year-range from the end of a value string.
 *
 * Matches:
 *   "ETH Zurich (1928-1940)"  → { baseLabel: "ETH Zurich", start: 1928, end: 1940 }
 *   "Physicist (2005)"        → { baseLabel: "Physicist",  start: 2005, end: 2005 }
 *
 * Returns null if the string does not end with a parenthesised year.
 *
 * @param {string} str
 * @returns {{ baseLabel: string, start: number, end: number } | null}
 */
function parseYearRange (str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/^(.*?)\s*\((\d{4})(?:-(\d{4}))?\)\s*$/);
  if (!m) return null;
  const start = parseInt(m[2], 10);
  const end = m[3] ? parseInt(m[3], 10) : start;
  return { baseLabel: m[1].trim(), start, end };
}

/**
 * Merge dated items that share the same base label and have overlapping or
 * adjacent year spans (gap ≤ 1 year).  Returns a new array sorted by start
 * year; the original array is not mutated.
 *
 * Merging preserves any `related` or `searchUrl` link from any item in the
 * merged group (the first found value wins).
 *
 * @param {Array<object>} items - items that all have parseable year ranges
 * @returns {Array<object>}
 */
function mergeAdjacentRanges (items) {
  // Group items by normalised (lowercase) base label so "CEO" and "ceo"
  // are treated as the same base label.
  const groups = new Map();
  for (const item of items) {
    const parsed = parseYearRange(item.value);
    const key = parsed.baseLabel.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ item, parsed });
  }

  const result = [];

  for (const group of groups.values()) {
    // Sort group by start year before attempting to merge.
    group.sort((a, b) => a.parsed.start - b.parsed.start);

    // Walk through and merge overlapping / adjacent spans.
    // Seed the accumulator with the first item.
    const acc = [{ ...group[0].item, _p: group[0].parsed }];

    for (let i = 1; i < group.length; i++) {
      const cur = group[i].parsed;
      const last = acc[acc.length - 1];

      if (cur.start <= last._p.end + 1) {
        // Spans overlap or are adjacent — extend the accumulated end date.
        const newEnd = Math.max(last._p.end, cur.end);
        const label = last._p.baseLabel; // preserve original casing of the first item
        last.value = (newEnd === last._p.start)
          ? `${label} (${last._p.start})`
          : `${label} (${last._p.start}-${newEnd})`;
        last._p = { ...last._p, end: newEnd };

        // Carry forward any link that exists in the merged-in item if the
        // accumulated entry does not already have one.
        if (!last.related && group[i].item.related) last.related = group[i].item.related;
        if (!last.searchUrl && group[i].item.searchUrl) last.searchUrl = group[i].item.searchUrl;
      } else {
        // Non-adjacent gap — keep as a separate entry.
        acc.push({ ...group[i].item, _p: cur });
      }
    }

    for (const entry of acc) {
      delete entry._p; // remove the temporary parse data
      result.push(entry);
    }
  }

  // Re-sort across all label groups by start year, then alphabetically.
  result.sort((a, b) => {
    const pa = parseYearRange(a.value);
    const pb = parseYearRange(b.value);
    if (!pa || !pb) return 0;
    return pa.start !== pb.start
      ? pa.start - pb.start
      : a.value.localeCompare(b.value, undefined, { sensitivity: 'base' });
  });

  return result;
}

/**
 * Sort undated items alphabetically. When there are more than THRESHOLD
 * items, linked items (those with a `related` URL or `searchUrl`) are
 * promoted to the top of each group so that navigable entries are easy
 * to find without disrupting alphabetical order within each group.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
function sortWithoutDates (items) {
  const byValue = (a, b) =>
    String(a.value).localeCompare(String(b.value), undefined, { sensitivity: 'base' });

  if (items.length <= THRESHOLD) {
    // Short list — simple alphabetical sort.
    return [...items].sort(byValue);
  }

  // Longer list — linked items first (alpha), then unlinked (alpha).
  const linked = items.filter(i => i.related || i.searchUrl).sort(byValue);
  const unlinked = items.filter(i => !i.related && !i.searchUrl).sort(byValue);
  return [...linked, ...unlinked];
}

/**
 * Process a single property's value array: merge duplicate date ranges,
 * sort, and order items according to the rules described at the top of
 * this file.
 *
 * Returns the original array unchanged when it has zero or one item.
 *
 * @param {Array<object>} values
 * @returns {Array<object>}
 */
function processPropertyValues (values) {
  if (!Array.isArray(values) || values.length <= 1) return values;

  const withDates = values.filter(v => parseYearRange(v.value) !== null);
  const withoutDates = values.filter(v => parseYearRange(v.value) === null);

  if (withDates.length > 0) {
    // At least some dated entries — merge and sort those, append undated items.
    const merged = mergeAdjacentRanges(withDates);
    return [
      ...merged,
      ...withoutDates.sort((a, b) =>
        String(a.value).localeCompare(String(b.value), undefined, { sensitivity: 'base' })
      )
    ];
  }

  return sortWithoutDates(withoutDates);
}

module.exports = { processPropertyValues, THRESHOLD };
