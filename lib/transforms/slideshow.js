const getPrimaryValue = require('../get-primary-value');

module.exports = (queryParams, results, config) => {
  const rootUrl = config.rootUrl || '';
  const mediaPath = config.mediaPath || '';

  const hits = (results.body.hits || {}).hits || [];

  const data = hits.map(h => {
    if (h._source) {
      return {
        title: getPrimaryValue(h._source.title),
        image: mediaPath + h._source.multimedia[0].processed.large.location,
        identifier: getPrimaryValue(h._source.identifier),
        link: rootUrl + '/objects/' + h._source.admin.uid
      };
    }
  });

  return data;
};
