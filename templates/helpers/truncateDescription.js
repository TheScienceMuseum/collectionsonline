module.exports = (name) => {
  if (!name) {
    return '';
  }

  return name.length < 400 ? name : name.slice(0, 400) + '...';
};
