function getScore (lower, upper, cb) {
  if (arguments.length === 2 && typeof upper === 'function') {
    cb = upper;
  }

  require('./scores').getAll(function (err, scores) {
    if (err) console.log(err);

    cb(null, scores.filter(el => {
      if (upper) {
        return el.count >= lower && el.count < upper;
      }
      return el.count >= lower;
    }).map(el => el.id));
  });
}

module.exports = getScore;
