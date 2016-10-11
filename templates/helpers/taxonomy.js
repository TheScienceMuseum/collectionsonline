module.exports = (item, options) => {
  if (item.key === 'taxonomy') {
    return options.fn(item);
  } else {
    return options.inverse(item);
  }
};
