module.exports = (e, ctx, q) => {
  var name = e.target.name;
  var value = e.target.value;
  var selected = ctx.state.data.selectedFilters;
  var qs = {};
  qs.q = q;

  if (selected[name]) {
    if (selected[name][value]) {
      delete selected[name][value];
      if (!Object.keys(selected[name]).length) {
        delete selected[name];
      }
    } else {
      selected[name][value] = true;
    }
  } else {
    selected[name] = {};
    selected[name][value] = true;
  }

  Object.keys(selected).forEach(el => {
    qs[el] = Object.keys(selected[el]).join();
  });

  return qs;
};
