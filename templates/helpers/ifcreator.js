const makersList = require('../../fixtures/makers');
module.exports = (related, options) => {
  // If any of these roles match, see more button will link to
  // search page with 'maker' filter selected as the person
  // If not, it will link to object search page with the person as the query
  // var makerRoles = ['creator', 'designer', 'engineer', 'inventor'];
  var makerRoles = makersList;

  if (related.length > 0 && related.some(el => makerRoles.indexOf(el.role.toLowerCase()) > -1)) {
    return options.fn(options.data.root);
  } else {
    return options.inverse(options.data.root);
  }
};
