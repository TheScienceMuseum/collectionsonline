module.exports = function (page) {
  page(function (ctx, next) {
    console.warn('Page not found', ctx.path);

    // Temporary until templates pulled into js for client side rendering
    if (!ctx.isInitialRender) {
      window.location = ctx.path;
    }

    next();
  });
};
