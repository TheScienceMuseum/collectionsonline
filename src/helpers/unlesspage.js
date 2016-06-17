module.exports = (pageName, options) => {
  if (options.data.root.page === pageName) {
    return '';
  } else {
    return options.fn(options.data.root);
  }
}
