const levelup = require('level');
const db = levelup('./counts');

module.exports = {
  getAll (cb) {
    var arr = [];

    db.createReadStream()
      .on('data', function (data) {
        var obj = {};

        obj[data.key] = data.value;
        arr.push(obj);
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
    var count;

    db.get(id, function (err, data) {
      if (err) console.log(err);

      count = parseInt(data) || 0;
      db.put(id, count + 1, function (err) {
        if (err) console.log(err);

        db.close();
      });
    });
  }
};
