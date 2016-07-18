var Templates = require('../templates');

module.exports = function (page) {
  // page(function (ctx, next) {
  //   next();
  // });
  page(render);
  function render (ctx, next) {
    console.warn('Page not found', ctx.path);
    var error = {
      error: {
        output: {
          payload: {
            status: 404,
            error: 'Page not found',
            message: 'Page not found for ' + ctx.path
          }
        }
      }
    };
    var pageEl = document.getElementsByTagName('main')[0];
    pageEl.innerHTML = Templates['error'](error);
  }
};
