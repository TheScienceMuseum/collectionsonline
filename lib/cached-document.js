const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache.js');
const getPrimaryValue = require('./get-primary-value');

module.exports = (elastic, id, fondsId, callback) => {
  cache.start()
  .then(
    cache.get({segment: 'documents', id: fondsId}).then((cached) => {
      if (cached) {
        return callback(null, cached.item);
      }
      return getFullArchive(elastic, id, function (err, data) {
        var tree;
        if (err) {
          return callback(err);
        }
        tree = archiveTree.sortChildren(data);
        cacheDocument(elastic, cache, fondsId, tree);
        return callback(null, tree);
      });
    }).catch((err) => console.log(err))
  )
  .catch((err) => {
    if (err && err.code === 'ECONNREFUSED') {
      return getFullArchive(elastic, id, function (err, data) {
        var tree;
        if (err) {
          return callback(err);
        }
        tree = archiveTree.sortChildren(data);
        return callback(null, tree);
      });
    }
  });
};

function getFullArchive (elastic, id, callback) {
  var fond;
  var data = [];
  elastic.get({index: 'smg', type: 'archive', id: id}, (err, result) => {
    if (err) return callback(err);
    if (result._source.level.value === 'fonds') {
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
      return callback(null, [{id: id, summary_title: result._source.summary_title}]);
    }
    data.push(fond);
    getAllFromArchive(elastic, fond.id, function (err, result) {
      if (err) return callback(err);
      callback(null, data.concat(result.map(el => {
        return {
          id: el._source.admin.uid,
          parent: el._source.parent,
          identifier: getPrimaryValue(el._source.identifier),
          summary_title: el._source.summary_title
        };
      })));
    });
  });
}

function cacheDocument (elastic, cache, id, data) {
  cache.set({segment: 'documents', id: id}, data, 100000000, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log('successfully cached');
    }
    cache.stop();
  });
}
