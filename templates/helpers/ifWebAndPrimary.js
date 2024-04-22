module.exports = (description, options) => {
  if (description.web && description.primary) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
};
