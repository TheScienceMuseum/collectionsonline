const TypeMapping = require('../type-mapping');

module.exports = (queryParams, results, config) => {
  const rootUrl = config.rootUrl;
  const typePath = queryParams.type ? `/${queryParams.type}` : '';
  const q = queryParams.q;
  const self = `${rootUrl}/autocomplete${typePath}?q=${encodeURIComponent(q)}`;

  const links = { self };
  const data = results.body.hits.hits.map((hit) => {
    const id = TypeMapping.toExternal(hit._id);
    // Not hit._type: that's the index mapping type ('data'), not the record type.
    const type = TypeMapping.toExternal(hit._source['@datatype']?.base);
    const links = { self: `${rootUrl}/${type}/${id}` };
    const title = hit._source.title?.[0]?.value || hit._source.summary?.title;
    const attributes = { title };
    return { id, type, attributes, links };
  });
  return { links, data };
};
