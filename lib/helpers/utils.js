const dashToSpace = require('./dash-to-space');

module.exports = {
  uppercaseFirstChar: function (filter) {
    let res = filter;
    if (typeof filter === 'string') {
      res = upperChar(filter);
      res = (res.toString().startsWith('Bbc')) ? res = 'BBC Heritage Collection' : res;
    } else if (Array.isArray(filter)) {
      res = filter.map(upperChar);
    }
    return res;
  }
};

function upperChar (str) {
  const exclude = ['and'];
  if (!str) return false;
  // dashToSpace BEFORE decodeURIComponent: plain dashes (from spaces) become spaces,
  // %2D sequences are not dashes so survive, then decodeURIComponent restores them to -
  // Apply decodeURIComponent twice: the server-side path has Hapi pre-decode %25→%
  // so one pass suffices (%2c→,), but the SPA client path has no pre-decode and needs
  // two passes (%252c→%2c→,). The second pass is a no-op for already-decoded values.
  let s = dashToSpace(str);
  try { s = decodeURIComponent(s); } catch (e) { /* malformed sequence, keep as-is */ }
  try { s = decodeURIComponent(s); } catch (e) { /* malformed sequence, keep as-is */ }
  const decoded = s;
  return decoded
    .split('/')
    .map(segment =>
      segment.split(/\s+/g).map(e => {
        if (exclude.indexOf(e) === -1 && e !== '') {
          // Capitalize first letter of each hyphen-separated part (e.g. Rolls-Royce, Burgoyne-Johnson)
          return e.split('-').map(part => {
            if (exclude.indexOf(part) === -1 && part.length) {
              return part[0].toUpperCase() + part.substring(1);
            }
            return part;
          }).join('-');
        }
        return e;
      }).join(' ')
    )
    .join('/');
}
