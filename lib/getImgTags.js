module.exports = (elastic, next) => {

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
                     size: 500
                   }
          },
          imgtagsParents: {
            terms: { field: 'multimedia.enhancement.rekognition.label.parents.name.keyword',
                     size: 500
                   }
          },
      }
    }
  }

  const body = { body:
    {
      "query": {
          "match_all": {}
      },
      "aggs": aggregations

    }
  }

  elastic.search(body, (err, result) => {
    return next(err, result);
  });
}
