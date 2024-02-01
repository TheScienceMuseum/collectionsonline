module.exports = function normaliseName (name, obj) {
  if (
    obj.type !== 'people' ||
    (obj.system && obj.system.value === 'AdLib') ||
    name.indexOf(',') === -1
  ) {
    return name;
  } else {
    const splitName = name.split(',');
    return (splitName[1] + ' ' + splitName[0]).trim();
  }
};
