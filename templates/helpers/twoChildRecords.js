module.exports = (childRecords) => {
  if (!childRecords) {
    return;
  }
  const twoRecords = childRecords.length <= 2;

  return twoRecords;
};
