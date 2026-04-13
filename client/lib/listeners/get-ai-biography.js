const getData = require('../get-data');
const Templates = require('../../templates');

module.exports = function () {
  const el = document.getElementById('aiBiography');
  if (!el) return;

  const personId = el.dataset.personId;
  if (!personId) return;

  const url = '/ai/biography/' + personId;
  const opts = {
    headers: { Accept: 'application/json' }
  };

  getData(url, opts, function (err, data) {
    if (err || !data || !data.biography) {
      el.style.display = 'none';
      return;
    }

    const hasWikidata = data.sources && data.sources.indexOf('wikidata') !== -1;

    el.innerHTML = Templates.aiBiography({
      biography: data.biography,
      context: data.context || '',
      personName: data.personName || 'this person',
      hasWikidata
    });

    // If existing description is very short, suppress it
    if (data.suppressExisting) {
      const descBlock = document.querySelector('.record-description');
      if (descBlock) {
        descBlock.style.display = 'none';
      }
    }
  });
};
