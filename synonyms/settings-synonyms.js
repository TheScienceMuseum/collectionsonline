const client = require('./client');

client.indices.getSettings({
  index: 'smg'
}, function (errorSettings, responseSettings) {
  console.log('error:', errorSettings);
  console.log(JSON.stringify(responseSettings, null, 2));
});
