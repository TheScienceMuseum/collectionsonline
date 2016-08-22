const Async = require('async');
const levelup = require('level');
const db = levelup('./counts');

module.exports = {
  getCount (count, cb) {
    var counts = ['0000000', '0010000', '0100000', '1000000'];
    var arr = [];

    db.createReadStream({gt: `${count}!`, lt: `${counts[counts.indexOf(count) + 1]}!`})
      .on('data', function (data) {
        arr.push(data.key.split('!')[1]);
      })
      .on('error', function (err) {
        db.close();
        return cb(err);
      })
      .on('end', function () {
        db.close();
        return cb(null, arr);
      });
  },

  update (id) {
    findInDB(id, function (err, data) {
      if (err) console.log(err);
      if (data) {
        var newCount = parseInt(data.count) + 1;
        if (newCount >= data.nextIdCount) {
          db.put(`${data.nextIdCount}!${id}`, newCount.toString(), function (err) {
            if (err) console.log(err);
            db.del(`${data.idCount}!${id}`, function (err) {
              if (err) console.log(err);
              db.close();
            });
          });
        } else {
          db.put(`${data.idCount}!${id}`, newCount.toString(), function (err) {
            if (err) console.log(err);
            db.close();
          });
        }
      } else {
        db.put(`0000000!${id}`, '1', function (err) {
          if (err) console.log(err);
          db.close();
        });
      }
    });
  }
};

function findInDB (id, callback) {
  Async.waterfall([
    function (cb) {
      db.get(`0000000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0000000', nextIdCount: '0010000', count: item});
      }
      db.get(`0010000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0010000', nextIdCount: '0100000', count: item});
      }
      db.get(`0100000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    },
    function (item, cb) {
      if (item) {
        return callback(null, {idCount: '0100000', nextIdCount: '1000000', count: item});
      }
      db.get(`1000000!${id}`, function (err, value) {
        if (err) console.log(err);
        return cb(null, value);
      });
    }
  ],
  function (err, item) {
    return callback(err, {idCount: '1000000', count: item});
  });
}
