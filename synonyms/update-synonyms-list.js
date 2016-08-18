const client = require('./client');

module.exports = function (synonyms, cb) {
  const settings = {
    analysis: {
      filter: {
        synonymsfilter: {
          type: 'synonym',
          synonyms: synonyms
        }
      },
      analyzer: {
        synonymsanalyzer: {
          tokenizer: 'standard',
          filter: [
            'lowercase',
            'synonymsfilter'
          ]
        }
      }
    }
  };

  client.indices.close({
    index: 'smg'
  }, function (errorClose, responseClose) {
    if (errorClose) {
      return cb(errorClose, responseClose);
    }
    client.indices.putSettings({
      index: 'smg',
      body: settings
    }, function (errorSettings, responseSettings) {
      if (errorSettings) {
        return cb(errorSettings, responseSettings);
      }
      client.indices.open({
        index: 'smg'
      }, function (errorOpen, responseOpen) {
        if (errorOpen) {
          return cb(errorOpen, responseOpen);
        }
        return cb(null, 'Synonyms list deployed');
      });
    });
  });
};
