module.exports = async (elastic, qCode, count) => {
  if (!qCode) {
    return;
  }
  const body = {
    size: count || 1,
    query: {
      bool: {
        must: [
          {
            term: {
              'wikidata.keyword': `https://www.wikidata.org/wiki/${qCode}`
            }
          }
        ]
      }
    }
  };

  const searchOpts = {
    index: 'ciim',
    body
  };

  const result = await elastic.search(searchOpts);

  if (result.body.hits.hits.length === 0) {
    return;
  }

  return result.body.hits.hits;
};
