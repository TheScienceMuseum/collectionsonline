'use strict';

module.exports = function (description) {
  var splitDescription = description.split('\n');
  var initialDescription, moreDescription;

  if (splitDescription.length > 15) {
    initialDescription = splitDescription.slice(0, 14);
    moreDescription = splitDescription.slice(15);

    return {
      initialDescription: initialDescription,
      moreDescription: moreDescription
    };
  }

  return { initialDescription: splitDescription };
};
