module.exports = () => ([
  require('./home')(),
  require('./search')(),
  require('./public')(),
  require('./archive')(),
  require('./archivedoc')(),
  require('./object')(),
  require('./person')()
]);
