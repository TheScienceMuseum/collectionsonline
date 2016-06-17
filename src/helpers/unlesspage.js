module.exports = (pageName, context) => {
  if (context.data.root.page === pageName) {
    return '';
  } else {
    return context.fn(this);
  }
}
