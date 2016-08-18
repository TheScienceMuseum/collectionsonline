const updateSynonymsList = require('./update-synonyms-list');
const synonyms = require('./synonyms.json');
updateSynonymsList(synonyms, function (error, response) {
  console.log('Error:');
  console.log(error);
  console.log('Response:');
  console.log(response);
});
