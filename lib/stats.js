module.exports = async (elastic) => {
  const searchOpts = {
    body: [
      // object record count [0] / [1]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }] } }, size: 0},
      // object record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // SPH object records [2] / [3]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }] } }, size: 0 },
      // SPH object records with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // MPH object records [4] / [5]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }] } }, size: 0 },
      // MPH object records with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // Part object records ie. parent is SPH or MPH [6] / [7]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { bool: { should: [{ term: { 'grouping.@link.type': 'SPH' } }, { term: { 'grouping.@link.type': 'MPH' } }] } }] } }, size: 0 },
      // Part object records wiht image ie. parent is SPH or MPH
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { bool: { should: [{ term: { 'grouping.@link.type': 'SPH' } }, { term: { 'grouping.@link.type': 'MPH' } }] } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // archive record count [8] / [9]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }] } }, size: 0 },
      // archive record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // agent record count [10]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }], must_not: [], should: [] } }, size: 0 }
    ]
  };
  return await elastic.msearch(searchOpts);
};
