module.exports = ({ elastic, config }) => ([
  require('./home')(),
  require('./search')({ elastic, config }),
  require('./public')(),
  require('./archive')({ elastic }),
  require('./archivedoc')({ elastic }),
  require('./object')({ elastic }),
  require('./person')({ elastic })
]);
