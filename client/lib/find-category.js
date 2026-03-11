module.exports = function findCategory (path) {
  const types = ['objects', 'people', 'documents', 'group'];
  return path.split('/').find(function (segment) {
    return types.indexOf(segment) !== -1;
  });
};
