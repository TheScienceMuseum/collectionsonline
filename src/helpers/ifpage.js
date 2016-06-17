module.exports = (pageName, context) => {
  if (context.data.root.page === pageName) {
    return context.fn(this);
  } else {
    return '';
  }
}
