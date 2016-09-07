const Async = require('async');
const level = require('../lib/level.js');

module.exports = {
  getCount (count, cb) {
    var counts = ['0000000', '0010000', '0100000', '1000000'];
    var arr = [];
    var streamOpts = {gt: `${padZero(count, 7)}!`};

    if (counts[counts.indexOf(padZero(count, 7)) + 1]) {
      streamOpts.lt = `${counts[counts.indexOf(padZero(count, 7)) + 1]}!`;
    }

    level.createReadStream(streamOpts)
      .on('data', function (data) {
        arr.push(data.key.split('!')[1]);
      })
      .on('error', function (err) {
        return cb(err);
      })
      .on('end', function () {
        return cb(null, arr);
      });
  },

  update (id, cb) {
    findInDB(id, function (err, data) {
      if (err) console.log(err);
      if (data) {
        var newCount = parseInt(data.count) + 1;
        if (newCount >= parseInt(data.nextIdCount)) {
          level.put(`${data.nextIdCount}!${id}`, newCount.toString(), function (err) {
            if (err) return cb(err);
            level.del(`${data.idCount}!${id}`, function (err) {
              if (err) {
                return cb(err);
              } else {
                cb(null, `${id} count and group updated`);
              }
            });
          });
        } else {
          level.put(`${data.idCount}!${id}`, newCount.toString(), function (err) {
            if (err) {
              return cb(err);
            } else {
              cb(null, `${id} count updated`);
            }
          });
        }
      } else {
        level.put(`0000000!${id}`, '1', function (err) {
          if (err) {
            return cb(err);
          } else {
            cb(null, `${id} added to db`);
          }
        });
      }
    });
  }
};

function findInDB (id, callback) {
  Async.waterfall([
    function (cb) {
      level.get(`0000000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0000000', nextIdCount: '0010000', count: item});
      }
      level.get(`0010000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0010000', nextIdCount: '0100000', count: item});
      }
      level.get(`0100000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0100000', nextIdCount: '1000000', count: item});
      }
      level.get(`1000000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(err, {idCount: '1000000', count: value});
      });
    }
  ],
  function (err, item) {
    if (err) {
      return callback(err);
    }
    return callback(null, item);
  });
}

function padZero (num, digits) {
  var padded = num.toString();
  while (padded.length < digits) {
    padded = '0' + padded;
  }
  return padded;
}
