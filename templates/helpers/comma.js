module.exports = (item, parent, and) => {
  if (parent.length >= 2 && parent[parent.length - 2].value === item.value && and) {
    // Display 'and' instead of the last comma if required
    return ' and';
  } else if (parent[parent.length - 1].value !== item.value) {
    return ',';
  }
};
