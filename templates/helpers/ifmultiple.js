module.exports = (num, options) => {
  const count = typeof num === 'number' ? num : num.length;

  if (count > 1) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
