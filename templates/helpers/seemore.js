module.exports = (related, options) => {
  if (related.length > 5) {
    return options.fn(options.data.root);
  }
};
