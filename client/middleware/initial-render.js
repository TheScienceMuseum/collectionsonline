var isInitialRender = true;
module.exports = function (page) {
  page(function (ctx, next) {
    ctx.isInitialRender = isInitialRender;
    isInitialRender = false;
    next();
  });
};
