const getRelatedItems = require('../../lib/get-related-items');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, related, database, next) {
  database.related = database.related || {};
  database.related.error = { error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' }, response: null };
  let count = 0;
  related.forEach(async item => {
    let items;
    let error;
    try {
      items = await getRelatedItems(elastic, item.id);
    } catch (err) {
      error = err;
    }

    const response = {};
    response.hits = { hits: items };
    database.related[TypeMapping.toInternal(item.id)] = { error, response };
    database.related.ap24329 = { error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' } };
    count += 1;
    if (count === related.length) {
      return next();
    }
  });
};
