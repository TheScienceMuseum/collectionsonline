module.exports = ({ elastic }) => ([
  require('./home')(),
  require('./search')({ elastic }),
  require('./public')(),
  require('./archive')(),
  require('./archivedoc')(),
  require('./object')(),
  require('./person')()
]);
