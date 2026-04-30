// Local-storage-backed scan history with a 7-day TTL.
//
// Shape on disk: { [uid]: { uid, barcodeId, title, image, path, description, date } }
// `date` is a millisecond timestamp; entries older than WEEK_MS are pruned on load.

const KEY = 'scans';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readRaw () {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function writeRaw (obj) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (err) {
    // quota exceeded or storage disabled — drop silently
  }
}

// Returns scans newest-first, after pruning anything older than a week.
function load () {
  const all = readRaw();
  const now = Date.now();
  const kept = {};
  for (const [uid, entry] of Object.entries(all)) {
    if (entry && entry.date && now - entry.date < WEEK_MS) {
      kept[uid] = entry;
    }
  }
  writeRaw(kept);
  return Object.values(kept).sort(function (a, b) { return b.date - a.date; });
}

// Add or refresh a scan. Returns the updated list (newest first).
function add (entry) {
  if (!entry || !entry.uid) return load();
  const all = readRaw();
  all[entry.uid] = Object.assign({}, entry, { date: Date.now() });
  writeRaw(all);
  return load();
}

function get (uid) {
  const all = readRaw();
  return all[uid] || null;
}

function clear () {
  writeRaw({});
  return [];
}

module.exports = { load, add, get, clear };
