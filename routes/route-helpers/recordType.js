module.exports = (groupingTypeOne, groupingTypeTwo) => {
  let groupingType;

  if (groupingTypeOne) {
    groupingType = groupingTypeOne;
  } else if (
    groupingTypeTwo &&
    Array.isArray(groupingTypeTwo) &&
    groupingTypeTwo.length > 0
  ) {
    groupingType = groupingTypeTwo[0];
  }

  return groupingType;
};
