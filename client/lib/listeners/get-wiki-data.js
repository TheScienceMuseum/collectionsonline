const getData = require('../get-data');
const Templates = require('../../templates');
module.exports = async function () {
  const wikiInfo = document.getElementById('wikiInfo');
  const data = await displayData();

  if (!data) {
    return;
  }

  const _data = { ...data };

  // destructuring to change order of data in ui
  const {
    P18: imageUrl = null,
    P214: viaf = null,
    P154: logoUrl = null,
    P1415: oxfordDnb = null,
    ...info
  } = _data;

  // prioritises image or logo url, as some companies will only have a logo, not an image
  const finalImageUrl = imageUrl || logoUrl;

  // we want all wikidata records to have the viaf and oxford dnb at the bottom
  const sortedInfo = {
    ...info,
    ...(viaf && { P214: viaf }),
    ...(oxfordDnb && { P1415: oxfordDnb })
  };

  // final wikidata object
  const wikiData = {
    ...(finalImageUrl && { image: finalImageUrl }),
    ...(JSON.stringify(sortedInfo) !== '{}' && { sortedInfo })
  };

  // add Wikidata URL to HB object
  wikiData.wikidataUrl = data.wikidataUrl.value;

  if (wikiData) {
    wikiInfo.innerHTML = Templates.wikiInfo({ wikiData });
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
