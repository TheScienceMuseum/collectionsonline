module.exports = async (elastic) => {
  const searchOpts = {
    body: [
      // object record count
      { index: 'smg' },
      { 'query': { 'bool': { 'must': [{ 'term': { 'type.base': 'object' } }] } }, 'size': 0 },
      // object record count with images
      { index: 'smg' },
      { 'query': { 'bool': { 'must': [{ 'term': { 'type.base': 'object' } }, { 'wildcard': { 'multimedia.identifier.value': '*' } }] } }, 'size': 0 },
      // archive record count
      { index: 'smg' },
      { 'query': { 'bool': { 'must': [{ 'term': { 'type.base': 'archive' } }] } }, 'size': 0 },
      // archive record count with images
      { index: 'smg' },
      { 'query': { 'bool': { 'must': [{ 'term': { 'type.base': 'archive' } }, { 'wildcard': { 'multimedia.identifier.value': '*' } }] } }, 'size': 0 },
      // agent record count
      { index: 'smg' },
      { 'query': { 'bool': { 'must': [{ 'term': { 'type.base': 'agent' } }], 'must_not': [], 'should': [] } }, 'size': 0 }
    ]
  };
  return await elastic.msearch(searchOpts);
};
