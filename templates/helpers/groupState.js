module.exports = (displayBox) => {
  return Array.isArray(displayBox) && displayBox.length > 1
    ? 'Part of Topics'
    : 'Part of Topic';
};
