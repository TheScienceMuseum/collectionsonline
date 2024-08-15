module.exports = (value) => {
  const hiddenItems = value.value.filter((val) => val.hide);
  const shouldBeHidden = hiddenItems.length > 0;
  return (
    (value && value.value.length === 0) ||
    value.value === undefined ||
    value.value === null ||
    shouldBeHidden
  );
};
