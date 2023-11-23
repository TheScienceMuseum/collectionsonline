module.exports = async (elastic) => {
  const searchOpts = {
    body: [
      // object record count
      { index: 'ciim' },
      { query: { bool: { must: [{ term: { '@datatype.base': 'object' } }] } }, size: 0 },
      // object record count with images
      { index: 'ciim' },
      { query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },
      // archive record count
      { index: 'ciim' },
      { query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }] } }, size: 0 },
      // archive record count with images
      { index: 'ciim' },
      { query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },
      // agent record count
      { index: 'ciim' },
      { query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }], must_not: [], should: [] } }, size: 0 }
    ]
  };
  return await elastic.msearch(searchOpts);
};
