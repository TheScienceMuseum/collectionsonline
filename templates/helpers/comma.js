const dedupe = require('./dedupe');
module.exports = (item, parent, and) => {
  // console.log('parent[parent.length]:' + parent[parent.length - 1].value);
  // console.log('item:' + item.value);

  // to handle edge case - duplicate entry in Ciim
  const dedupedParent = dedupe(parent);

  if (dedupedParent.length >= 2 && dedupedParent[dedupedParent.length - 2].value === item.value) {
    // Display 'and' instead of the last comma if required

    return ' and';
  } else if (dedupedParent[dedupedParent.length - 1].value !== item.value) {
    // console.log('**comma**' + item.value);
    return ',';
  }
};
