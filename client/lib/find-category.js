const TYPES = ['objects', 'people', 'documents', 'group'];

// The type segment, if present, always sits immediately after /search/ in the path.
// e.g. /search/people/... → 'people'
//      /search/collection/people,-pride-and-progress → undefined (people is a filter value)
module.exports = function findCategory (path) {
  const segments = path.split('/');
  const searchIdx = segments.indexOf('search');
  if (searchIdx === -1) return undefined;
  const candidate = segments[searchIdx + 1];
  return TYPES.indexOf(candidate) !== -1 ? candidate : undefined;
};
