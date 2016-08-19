module.exports = (lower, upper) => {
  require('./scores').getAll(function (err, scores) {
    if (err) console.log(err);

    return scores.filter(el => {
      if (upper) {
        return el.count >= lower && el.count < upper;
      }
      return el.count >= lower;
    }).map(el => el.id);
  });
};
