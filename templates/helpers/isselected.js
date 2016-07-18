module.exports = (selected, facet, name) => {
  if (selected[facet] && selected[facet][name]) {
    return 'checked';
  } else {
    return '';
  }
};
