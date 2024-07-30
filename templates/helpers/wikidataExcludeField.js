module.exports = (value) => {
  return (
    (value && value.value.length === 0) ||
    value.value === undefined ||
    value.value === null
  );
};
