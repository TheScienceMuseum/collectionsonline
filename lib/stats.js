module.exports = async (elastic) => {
  const searchOpts = {
    body: [
      // objects: object record count [0] / [1]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }] } }, size: 0 },
      // objectsWithImages: object record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // recordsSPH: SPH object records [2] / [3]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }] } }, size: 0 },
      // recordsSPHWithImages: SPH object records with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // recordsSPHWithChildren: SPH object records with one or more children [4] / [5]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },
      // recordsSPHWithChildrenWithImages: SPH object records wiht (parent) image and with one or more children
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'SPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },

      // recordsMPH: MPH object record [6] / [7]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }] } }, size: 0 },
      // recordsMPHWithImages: MPH object record with image
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // recordsMPHWithChildren: MPH object record with one or more children [8] / [9]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },
      // recordsMPHWithChildrenWithImages: MPH object with image record with one or more children [8] / [9]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { '@datatype.grouping': 'MPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }, { term: { 'child.@entity': 'reference' } }] } }, size: 0 },

      // childOfSPH: Part object record where parent is SPH [10] / [11]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'SPH' } }] } }, size: 0 },
      // childOfSPHWithImage: Part object record with image where parent is SPH [11]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'SPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // childOfMPH: Part object record where parent is MPH [12] / [13]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'MPH' } }] } }, size: 0 },
      // childOfMPHWithImages: Part object record with image, where parent is MPH
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'object' } }, { term: { 'grouping.@link.type': 'MPH' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // archive record count [14] / [15]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }] } }, size: 0 },
      // archive record count with images
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'archive' } }, { term: { 'multimedia.@admin.source': 'smgi' } }] } }, size: 0 },

      // agent record count [16]
      { index: 'ciim' },
      { track_total_hits: true, query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }], must_not: [], should: [] } }, size: 0 }
    ]
  };
  return await elastic.msearch(searchOpts);
};
