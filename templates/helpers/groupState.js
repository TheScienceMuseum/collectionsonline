module.exports = (displayBox) => {
  return Array.isArray(displayBox) && displayBox.length > 1
    ? 'Part of Groups:'
    : 'Part of Group:';
};
