module.exports = (rights, options) => {
  // ↓↓↓ For future use when copyright details are corrected in index ↓↓↓
  // if (rights.indexOf('Board of Trustees of the Science Museum') > -1) {
  if ((rights && rights.cc) || (rights && rights.details && rights.details.indexOf('Science Museum') > -1)) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
