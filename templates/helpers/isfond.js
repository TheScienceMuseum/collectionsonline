module.exports = (options) => {
  if (options.data.root.level === 'archive') {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
