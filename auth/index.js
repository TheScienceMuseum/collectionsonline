module.exports = (elastic, config) => ([
  require('./login')(),
  require('./session')()
]);
