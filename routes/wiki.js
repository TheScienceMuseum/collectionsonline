const wbk = require('../lib/wikibase');

const wikidataConn = async (req, h) => {
  const { wikidata } = req.params;

  try {
    if (!wikidata) {
      return h.response('No wikidata supplied').code(404);
    }

    let entities;
    const languages = ['en', 'fr', 'de'];
    const props = ['info', 'claims'];
    const format = 'json';
    const redirections = false;
    try {
      entities = await wbk.getEntities(
        wikidata,
        languages,
        props,
        format,
        redirections
      );

      return entities;
    } catch (error) {
      console.error('Error fetching entities:', error);
      return h.response('Error fetching entities').code(500);
    }
  } catch (error) {
    console.error('There was an error:', error);
    return h.response('Internal Server Error').code(500);
  }
};

module.exports = (config) => ({
  method: 'get',
  path: '/wiki/{wikidata}',

  config: {
    handler: async (req, h) => {
      const wikidata = await wikidataConn(req);
      return h.response(wikidata).code(200);
    }
  }
});
