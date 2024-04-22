module.exports = (arr) => {
  if (arr && arr.length > 0) {
    const dedupedArr = arr.filter(
      (item, index, self) =>
        index ===
        self.findIndex((t) => t.value === item.value && t.link === item.link)
    );
    return dedupedArr;
  }
  return null;
};
