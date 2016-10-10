module.exports = (item, parent) => {
  if (parent.value[parent.value.length - 1].value !== item.value) {
    return ',';
  }
  console.log(item, parent);
};
