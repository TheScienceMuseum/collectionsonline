module.exports = (related, index, object, options) => {
  if (index < 5) {
    return options.fn(object);
  } else if (related.length > 12 && index < 11) {
    return options.fn(object);
  }
};
