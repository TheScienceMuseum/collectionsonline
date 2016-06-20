module.exports = ({ elastic, config }) => ([
  require('./home')(),
  require('./search')({ elastic, config }),
  require('./public')(),
  require('./archive')(),
  require('./archivedoc')(),
  require('./object')(),
  require('./person')()
]);
