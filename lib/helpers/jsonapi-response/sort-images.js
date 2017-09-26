var _ = require('lodash');

/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (upload date)
*/

module.exports = function (images) {
  var sorted = _.orderBy(images, [i => i.position || 99999, i => i.priority || 0.5, 'sort'], ['asc', 'desc', 'asc']);
  return sorted;
};
