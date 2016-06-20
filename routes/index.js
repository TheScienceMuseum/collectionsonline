module.exports = ({ elastic }) => ([
  require('./home')(),
  require('./search')({ elastic }),
  require('./public')(),
  require('./archive')({ elastic }),
  require('./archivedoc')({ elastic }),
  require('./object')({ elastic }),
  require('./person')({ elastic })
]);
