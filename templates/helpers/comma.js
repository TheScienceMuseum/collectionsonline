module.exports = (item, parent, and) => {
  console.log('parent[parent.length]:' + parent[parent.length - 1].value);
  console.log('item:' + item.value);
  if (parent.length >= 2 && parent[parent.length - 2].value === item.value) {
    // Display 'and' instead of the last comma if required
    return ' and';
  } else if (parent[parent.length - 1].value !== item.value) {
    console.log('**comma**' + item.value);
    return ',';
  }
};
