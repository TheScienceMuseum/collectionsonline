module.exports = async (elastic) => {
  const aggregations =
    { img_tags_aggs:
    {
      filter: {
        bool: {
          should: [
            { term: {'type.base': 'agent'} },
            { term: {'type.base': 'object'} },
            { term: {'type.base': 'archive'} }
          ]
        }
      },
      aggs: {
        imgtags: {
          terms: { field: 'multimedia.enhancement.rekognition.label.name.keyword',
            size: 20000
          }
        },
        imgtagsParents: {
          terms: { field: 'multimedia.enhancement.rekognition.label.parents.name.keyword',
            size: 20000
          }
        }
      }
    }
    };

  const searchOpts = {
    index: 'smg',
    body: { 'query': {
      'match_all': {}
    },
      'aggs': aggregations
    }
  };

  return await elastic.search(searchOpts);
};
