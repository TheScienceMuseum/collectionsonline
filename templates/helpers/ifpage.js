module.exports = (pageName, options) => {
  if (options.data.root.page === pageName) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
