module.exports = async (elastic) => {
  const aggregations =
    {
      img_tags_aggs:
    {
      filter: {
        bool: {
          should: [
            { term: {'@datatype.base': 'agent'} },
            { term: {'@datatype.base': 'object'} },
            { term: {'@datatype.base': 'archive'} }
          ]
        }
      },
      aggs: {
        imgtags: {
          terms: {
            field: 'multimedia.enhancement.rekognition.labels.value',
            size: 30000
          }
        },
        imgtagsParents: {
          terms: {
            field: 'multimedia.enhancement.rekognition.labels.parents.value',
            size: 30000
          }
        }
      }
    }
    };

  const searchOpts = {
    index: 'ciim',
    body: {
      query: {
        match_all: {}
      },
      aggs: aggregations
    }
  };

  return await elastic.search(searchOpts);
};
