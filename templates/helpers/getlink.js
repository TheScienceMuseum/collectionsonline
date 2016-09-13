module.exports = function findCurrent (obj, options) {
  var id;
  if (obj.tree) {
    id = obj.tree.id;
  } else {
    id = obj.id;
  }
  return options.data.root.links.root + '/documents/' + id;
};
