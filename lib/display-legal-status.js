module.exports = (attributes, key) => {
  const status = attributes[key].legal_status;

  if (status && status.toLowerCase().indexOf('auxillary material') > -1) {
    return false;
  } else {
    return true;
  }
};
