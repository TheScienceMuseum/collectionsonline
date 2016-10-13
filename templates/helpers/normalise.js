module.exports = function normaliseName (name, obj) {
  if (obj.type !== 'people' || obj.system.value === 'AdLib' || name.indexOf(',') === -1) {
    return name;
  } else {
    var splitName = name.split(',');
    return splitName[1] + ' ' + splitName[0];
  }
};
