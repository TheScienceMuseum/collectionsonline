/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (upload date)
*/

// compare function use in sort
function compare (img1, img2) {
  var img1Date = Date.parse(img1.sort);
  var img2Date = Date.parse(img2.sort);

  if (img1.priority < img2.priority) {
    return 1;
  }
  if (img1.priority > img2.priority) {
    return -1;
  }
  // if the priorities are equal sort by the proroperty sort
  if (img1Date < img2Date) {
    return 1;
  }
  if (img1Date > img2Date) {
    return -1;
  }

  return 0;
}

module.exports = function (images) {
  return images.sort(compare);
};
