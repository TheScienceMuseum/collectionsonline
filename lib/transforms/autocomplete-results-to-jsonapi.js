const TypeMapping = require('../type-mapping');

module.exports = (queryParams, results, config) => {
  const rootUrl = config.rootUrl;
  const typePath = queryParams.type ? `/${queryParams.type}` : '';
  const q = queryParams.q;
  const self = `${rootUrl}/autocomplete${typePath}?q=${encodeURIComponent(q)}`;

  const links = { self };
  const data = results.body.hits.hits.map((hit) => {
    const id = TypeMapping.toExternal(hit._id);
    const type = TypeMapping.toExternal(hit._type);
    const links = { self: `${rootUrl}/${type}/${id}` };
    const title = hit._source.title?.[0]?.value;
    const attributes = { title };
    return { id, type, attributes, links };
  });

  return { links, data };
};
