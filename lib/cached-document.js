const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const Catbox = require('catbox');
const CatboxRedis = require('catbox-redis');
var [ elasticacheHost, elasticachePort ] = ['127.0.0.1', '6379'];

if (process.env.ELASTICACHE_EP) {
  [ elasticacheHost, elasticachePort ] = process.env.ELASTICACHE_EP.split(':');
}

const cache = new Catbox.Client(CatboxRedis, {host: elasticacheHost, port: elasticachePort});

module.exports = (elastic, id, fondsId, callback) => {
  cache.start((err) => {
    if (err) console.log(err);
    cache.get({segment: 'documents', id: fondsId}, (err, cached) => {
      if (err) console.log(err);
      if (cached) return callback(null, cached.item);
      return getFullArchive(elastic, id, function (err, data) {
        if (err) {
          return callback(err);
        }
        cacheDocument(elastic, cache, fondsId, archiveTree.sortChildren(data));
        return callback(null, archiveTree.sortChildren(data));
      });
    });
  });
};

function getFullArchive (elastic, id, callback) {
  var fond;
  var data = [];
  elastic.get({index: 'smg', type: 'archive', id: id}, (err, result) => {
    if (err) callback(err);
    if (result._source.level.value === 'fonds') {
      fond = {
        id: id,
        summary_title: result._source.summary_title,
        identifier: result._source.identifier[0].value
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
      if (err) callback(err);
      callback(null, data.concat(result.map(el => {
        return {
          id: el._source.admin.uid,
          parent: el._source.parent,
          identifier: el._source.identifier[0].value,
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
