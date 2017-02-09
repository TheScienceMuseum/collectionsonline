'use strict';

module.exports = function (description) {
  var splitDescription = description
    .split('\n')
    .filter(function (line) {
      return line !== '';
    });
  var initialDescription, moreDescription;

  // display the first paragraph in the initialDescription
  // the rest in moreDescription
  if (splitDescription.length > 15) {
    initialDescription = splitDescription.slice(0, 1);
    moreDescription = splitDescription.slice(1);

    return {
      initialDescription: initialDescription,
      moreDescription: moreDescription
    };
  }

  return { initialDescription: splitDescription };
};
