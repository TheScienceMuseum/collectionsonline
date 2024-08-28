module.exports = (obj) => {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
};
