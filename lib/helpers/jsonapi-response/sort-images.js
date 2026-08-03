const orderBy = require('lodash/orderBy');

/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (date)
*/

module.exports = function (images) {
  // Guard `@processed`: not every multimedia entry carries a processed
  // derivative (an image still processing, a non-image asset). A missing
  // `@processed` here would throw and, for callers in the search path,
  // surface as a 503 for the whole response. `Date.parse(undefined)` is
  // NaN, which orderBy sorts to a consistent position — such entries have
  // no thumbnail to display anyway.
  const sorted = orderBy(images, [
    i => parseInt(i.position?.value) || 9999,
    i => Date.parse(i['@processed']?.upload_sort)
  ], ['asc', 'desc']);

  return sorted;
};
