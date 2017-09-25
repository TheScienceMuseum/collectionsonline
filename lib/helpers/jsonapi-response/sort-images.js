/*
* Sort the list of images by priority and by date upload, see #499
* @param {Array} images - array of images object
* The image object has the properties priority (0 to 9) and sort (upload date)
*/

// compare function use in sort
function compare (img1, img2) {
  var img1Date = Date.parse(img1.sort);
  var img2Date = Date.parse(img2.sort);

  var img1Pos = parseInt(img1.position);
  var img2Pos = parseInt(img2.position);

  // sort by page numebr / position if present
  // (P1,2,3 value in image object identifier field in Trinity)
  if (img1Pos < img2Pos) {
    return -1;
  }
  if (img1Pos > img2Pos) {
    return 1;
  }

  // sort by priority if avaliable (default = 0.5)
  if (img1.priority < img2.priority) {
    return 1;
  }
  if (img1.priority > img2.priority) {
    return -1;
  }

  // if the priorities are equal sort by the property sort
  if (img1Date < img2Date) {
    return -1;
  }
  if (img1Date > img2Date) {
    return 1;
  }

  return 0;
}

module.exports = function (images) {
  return images.sort(compare);
};
