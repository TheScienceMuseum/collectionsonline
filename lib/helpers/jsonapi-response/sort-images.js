const orderBy = require('lodash/orderBy');

/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (date)
*/

module.exports = function (images) {
  const sorted = orderBy(images, [
    i => parseInt(i.position) || 0,
    i => parseFloat(i.priority) || 0.5, // no longer in use
    i => Date.parse(i.sort)
  ], ['asc', 'desc', 'asc']);
  return sorted;
};
