const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache.js');
const getPrimaryValue = require('./get-primary-value');

module.exports = async (elastic, id, fondsId) => {
  try {
    await cache.start();
    const cached = await cache.get({ segment: 'documents', id: fondsId });
    if (cached) { return cached.item; }

    const data = await getFullArchive(elastic, id);
    const tree = archiveTree.sortChildren(data);

    cacheDocument(elastic, cache, fondsId, tree);

    return tree;
  } catch (err) {
    if (err && err.code === 'ECONNREFUSED') {
      const data = await getFullArchive(elastic, id);

      var tree = archiveTree.sortChildren(data);

      return tree;
    } else { throw err; }
  }
};

async function getFullArchive (elastic, id) {
  try {
    let fond;
    let data = [];
    const result = await elastic.get({ index: 'smg', type: 'archive', id: id });

    if (result._source.level && result._source.level.value === 'fonds') {
      fond = {
        id: id,
        summary_title: result._source.summary_title,
        identifier: getPrimaryValue(result._source.identifier)
      };
    } else if (result._source.fonds) {
      fond = {
        id: result._source.fonds[0].admin.uid,
        summary_title: result._source.fonds[0].summary_title
      };
    } else {
      return [{ id: id, summary_title: result._source.summary_title }];
    }

    data.push(fond);

    const res = await getAllFromArchive(elastic, fond.id);
    return data.concat(res.map(el => {
      return {
        id: el._source.admin.uid,
        parent: el._source.parent,
        identifier: getPrimaryValue(el._source.identifier),
        summary_title: el._source.summary_title
      };
    }));
  } catch (err) { throw err; }
}

function cacheDocument (elastic, cache, id, data) {
  cache.set({ segment: 'documents', id: id }, data, 100000000, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log('successfully cached');
    }
    cache.stop();
  });
}
