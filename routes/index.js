module.exports = (elastic, config) => ([
  require('./home')(),
  require('./search')(elastic, config),
  require('./public')(),
  require('./archive')(elastic, config),
  require('./object')(elastic, config),
  require('./person')(elastic, config)
]);
