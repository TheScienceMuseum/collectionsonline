module.exports = (identifier) => {
  var splitID = identifier.split('/');
  return splitID.slice(0, splitID.length - 1).join('/');
};
