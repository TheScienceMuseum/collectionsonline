module.exports = (totalPages, options) => {
  if (totalPages > 1) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
