const orderBy = require('lodash/orderBy');

/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (date)
*/

module.exports = function (images) {
  console.log(images);

  const sorted = orderBy(images, [
    i => parseInt(i.position?.value) || 9999,
    i => Date.parse(i['@processed'].large.modified)
  ], ['asc', 'desc']);

  return sorted;
};
