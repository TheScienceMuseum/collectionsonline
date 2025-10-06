'use strict';

module.exports = function (description) {

  const splitDescription = description
    .split('\n')
    .filter(function (line) {
      return line !== '';
    });
  let initialDescription, moreDescription;

  // console.log('description:' + description + '\n\n');
  
  // display the first paragraph in the initialDescription
  // the rest in moreDescription
  if (splitDescription.length > 15) {
    initialDescription = splitDescription.slice(0, 1);
    moreDescription = splitDescription.slice(1);

    return {
      initialDescription,
      moreDescription
    };
  }

  return { initialDescription: splitDescription };
};
