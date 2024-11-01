module.exports = (el) => {
  const hasList = el.every((e) => e.list);
  return !!hasList;
};
