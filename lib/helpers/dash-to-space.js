module.exports = function dashToSpace (str) {
  return str.replace(/---|-/g, function (match) {
    return match === '---' ? ' - ' : ' ';
  });
};
