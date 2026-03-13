'use strict';

module.exports = function (description, type) {
  const splitDescription = description
    .split('\n')
    .filter(function (line) {
      return line !== '';
    });
  let initialDescription, moreDescription;

  // console.log('description:' + description + '\n\n');

  // display the first paragraph in the initialDescription
  // the rest in moreDescription (not applied to people pages)
  if (type !== 'people' && splitDescription.length > 15) {
    initialDescription = splitDescription.slice(0, 1);
    moreDescription = splitDescription.slice(1);

    return {
      initialDescription,
      moreDescription
    };
  }

  return { initialDescription: splitDescription };
};
