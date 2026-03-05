const getData = require('../get-data');
const Templates = require('../../templates');
const setupWikiMore = require('./wiki-more');
module.exports = async function () {
  const wikiInfo = document.getElementById('wikiInfo');
  const data = await displayData();

  if (!data) {
    return;
  }

  const _data = { ...data };

  // destructuring to change order of data in ui
  // imageMetadata, wikipediaUrl, alsoInCollection and externalIdentifiers are pulled out
  // explicitly so they don't end up in sortedInfo and get rendered as regular properties
  const {
    P18: imageUrl = null,
    P154: logoUrl = null,
    imageMetadata = null,
    wikipediaUrl = null,
    alsoInCollection = null,
    colleagues = null,
    externalIdentifiers = null,
    ...info
  } = _data;

  // prioritises image or logo url, as some companies will only have a logo, not an image
  const finalImageUrl = imageUrl || logoUrl;

  const sortedInfo = { ...info };

  // final wikidata object
  const wikiData = {
    ...(finalImageUrl && { image: finalImageUrl }),
    ...(imageMetadata && { imageMetadata }),
    ...(wikipediaUrl && { wikipediaUrl }),
    ...(alsoInCollection && { alsoInCollection }),
    ...(colleagues && { colleagues }),
    ...(externalIdentifiers && { externalIdentifiers }),
    ...(JSON.stringify(sortedInfo) !== '{}' && { sortedInfo })
  };

  // add Wikidata URL to HB object
  wikiData.wikidataUrl = data.wikidataUrl ? data.wikidataUrl.value : 'https://www.wikidata.org';

  if (wikiData) {
    wikiInfo.innerHTML = Templates.wikiInfo({ wikiData });
    setupWikiMore(wikiInfo);
  }

  // handles black logos on black backgrounds
  if (finalImageUrl?.endsWith('svg')) {
    const imgPanel = document.querySelector('.bleed');
    imgPanel.style.backgroundColor = '#ffffff';
  }
};

// makes call to route handler and wikibase-sdk - brings back wikidata
async function displayData () {
  const wikiInfo = document.getElementById('wikiInfo');
  const url = '/wiki/' + wikiInfo?.dataset.name;
  const hasWikiInfo = !!wikiInfo;

  if (!hasWikiInfo) {
    return null;
  }
  try {
    const opts = {
      headers: { Accept: 'application/vnd.api+json' }
    };

    return new Promise((resolve, reject) => {
      getData(url, opts, function (_err, data) {
        if (_err) {
          reject(_err);
        } else {
          resolve(data);
        }
      });
    });
  } catch (error) {
    console.error('Error checking the URL or getting data:', error);
    return Promise.reject(error);
  }
}
