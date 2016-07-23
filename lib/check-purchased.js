module.exports = (attributes, key) => {
  const credit = attributes[key].credit_line;

  if (credit && credit.toLowerCase().indexOf('purchased') > -1) {
    return true;
  } else {
    return false;
  }
};
