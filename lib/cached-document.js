const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache.js');
const getPrimaryValue = require('./get-primary-value');

module.exports = async (elastic, id, fondsId) => {
  try {
    await cache.start();
    const cached = await cache.get({ segment: 'documents', id: fondsId });
    if (cached) {
      await cache.stop();
      return cached.item;
    }

    const data = await getFullArchive(elastic, id);
    const tree = archiveTree.sortChildren(data);

    cacheDocument(elastic, cache, fondsId, tree);

    return tree;
  } catch (err) {
    await cache.stop();

    // we should probaly handle, more gracefully, not having a redis/cache server
    // if (err && err.code === 'ECONNREFUSED') {
    if (err) {
      const data = await getFullArchive(elastic, id);
      const tree = archiveTree.sortChildren(data);
      return tree;
    } else {
      throw err;
    }
  }
};

async function getFullArchive (elastic, id) {
  try {
    let fond;
    const data = [];
    const result = await elastic.get({ index: 'ciim', id });

    if (result.body._source.level && result.body._source.level.value === 'fonds') {
      fond = {
        id,
        summary_title: result.body._source.summary.title,
        identifier: getPrimaryValue(result.body._source.identifier)
      };
    } else if (result.body._source.fonds) {
      fond = {
        id: result.body._source.fonds[0]['@admin'].uid,
        summary_title: result.body._source.fonds[0].summary.title
      };
    } else {
      return [{ id, summary_title: result.body._source.summary.title }];
    }

    data.push(fond);

    const res = await getAllFromArchive(elastic, fond.id);
    return data.concat(res.map(el => {
      return {
        id: el._source['@admin'].uid,
        parent: el._source.parent,
        identifier: getPrimaryValue(el._source.identifier),
        summary_title: el._source.summary.title
      };
    }));
  } catch (err) {
    await cache.stop();
    throw err;
  }
}

async function cacheDocument (elastic, cache, id, data) {
  try {
    await cache.set({ segment: 'documents', id }, data, 100000000);
    await cache.stop();
    console.log('successfully cached');
  } catch (err) {
    await cache.stop();
    console.log(err);
  }
}
