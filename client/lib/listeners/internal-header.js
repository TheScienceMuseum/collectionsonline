var fetch = require('node-fetch');
var FormData = require('form-data');

module.exports = () => {
  const scriptURL = 'https://script.google.com/macros/s/---/exec';

  // Add submit handler to 'internal header' form
  const wikiform = document.forms['wikidata-form'];
  if (wikiform) {
    wikiform.addEventListener('submit', e => {
      e.preventDefault();
      handleSuccess('success');
      fetch(scriptURL, { method: 'POST', body: new FormData(wikiform) })
       .then(response => handleSuccess(response))
       .catch(error => handleError(error));
    });
  }
};

function handleSuccess (response) {
  document.getElementById('wikidata-form').hidden = true;
  document.getElementById('sucessMessage').hidden = false;
  console.log('Success!', response);
}

function handleError (error) {
  document.getElementById('wikidata-form').hidden = true;
  document.getElementById('errorMessage').hidden = false;
  console.error('Error!', error.message);
}

