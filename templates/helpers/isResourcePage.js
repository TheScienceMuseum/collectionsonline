module.exports = (options) => {
  const resources = ['document', 'person', 'object'];

  if (resources.indexOf(options.data.root.page) > -1) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
