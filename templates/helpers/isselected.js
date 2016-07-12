module.exports = (selected, facet, name) => {
  if (selected[facet] && selected[facet][name.replace(/,/g, '\\,')]) {
    return 'checked';
  } else {
    return '';
  }
};
