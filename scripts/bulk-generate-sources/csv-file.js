'use strict';

// CSV / plaintext candidate source — reads a list of subject IDs from a
// file on disk. Tolerant format:
//   - One ID per line.
//   - First column of a CSV row (comma-separated). Everything after the
//     first comma on a line is ignored, so you can annotate rows without
//     breaking the parse.
//   - Blank lines and lines starting with `#` are ignored (comments).
//   - IDs are case-insensitive; the source lower-cases them to match the
//     format used elsewhere in the app.
//   - Any input that doesn't match /^[a-z]{2}\d+$/i is skipped with a
//     warning — catches typos early rather than letting the runner burn
//     API calls on ID-that-doesn't-exist errors.
//
// Usage:
//   node scripts/bulk-generate.js --source csv-file --csv <path>
//
// The runner's default idempotence check still applies — subjects already
// having a BIOGRAPHY item are skipped unless --force is set. Pass --force
// when your CSV is the "regenerate these specific records" list.

const fs = require('fs');
const path = require('path');

const ID_PATTERN = /^[a-z]{2}\d+$/i;

module.exports = async function list (elastic, config, opts) {
  const csvPath = opts.csvPath;
  if (!csvPath) {
    throw new Error('csv-file source requires --csv <path>');
  }
  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('csv-file: input file not found: ' + resolved);
  }

  console.log('csv-file: reading', resolved);
  const raw = fs.readFileSync(resolved, 'utf8');
  const lines = raw.split(/\r?\n/);

  const ids = [];
  let skipped = 0;
  lines.forEach(function (line, lineNo) {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.charAt(0) === '#') return;

    // First column of a CSV row. If there's no comma, take the whole
    // trimmed line as the id.
    const firstCol = trimmed.split(',')[0].trim();
    if (!firstCol) return;

    if (!ID_PATTERN.test(firstCol)) {
      console.warn('csv-file: line ' + (lineNo + 1) + ' skipped — "' + firstCol + '" is not a valid id');
      skipped++;
      return;
    }
    ids.push(firstCol.toLowerCase());
  });

  // Dedupe while preserving order — first occurrence wins so the CSV's
  // ordering (e.g. by curator priority) is respected.
  const seen = new Set();
  const deduped = ids.filter(function (id) {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log('csv-file: parsed', deduped.length, 'unique ids (', skipped, 'skipped as malformed )');
  return deduped;
};
