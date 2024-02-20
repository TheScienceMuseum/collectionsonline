module.exports = async (elastic) => {
  const searchOpts = {
    body: [
      // object record count [0] / [1]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }] } }, size: 0 },
      // object record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // SPH object records [2] / [3]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }] } }, size: 0 },
      // SPH object records with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // SPH object records with one or more children [4] / [5]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },
      // SPH object records wiht (parent) image and with one or more children
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },

      // MPH object record [6] / [7]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }] } }, size: 0 },
      // MPH object record with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // MPH object record with one or more children [8] / [9]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },
      // MPH object with image record with one or more children [8] / [9]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },

      // Part object record where parent is SPH [10] / [11]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'SPH' } }] } }, size: 0 },
      // Part object record with image where parent is SPH [11]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'SPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // Part object record where parent is MPH [12] / [13]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'MPH' } }] } }, size: 0 },
      // Part object record with image, where parent is MPH
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'MPH' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // archive record count [14] / [15]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }] } }, size: 0 },
      // archive record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }, { wildcard: { 'multimedia.identifier.value': '*' } }] } }, size: 0 },

      // agent record count [16]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }], must_not: [], should: [] } }, size: 0 }
    ]
  };
  return await elastic.msearch(searchOpts);
};
