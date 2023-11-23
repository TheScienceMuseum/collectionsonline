const getNested = require('../../lib/nested-property');
module.exports = function (obj, options) {
  let id;
  if (obj.tree) {
    id = obj.tree.id;
  } else {
    id = obj.id;
  }
  return getNested(options, 'data.root.links.root') + '/documents/' + id;
};
