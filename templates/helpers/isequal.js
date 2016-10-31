module.exports = (a, b, item, options) => {
  if (a === b) {
    return options.fn(item);
  } else {
    return options.inverse(item);
  }
};
