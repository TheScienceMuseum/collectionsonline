module.exports = (selected, facet, name) => {
  let isSelected = false;

  if (selected[facet] && typeof name === 'string') {
    for (const filterName in selected[facet]) {
      if (filterName.toLowerCase().split(' ').join('-') === name.toLowerCase().split(' ').join('-')) {
        isSelected = true;
      }
    }
  } else if (selected[facet] && name && typeof name === 'boolean') {
    isSelected = true;
  }

  if (isSelected) {
    return 'checked';
  } else {
    return '';
  }
};
