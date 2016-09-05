module.exports = function (classList, className) {
  if (classList.indexOf(className) > -1) {
    return classList.replace(className, '');
  } else {
    return classList + ' ' + className;
  }
};
