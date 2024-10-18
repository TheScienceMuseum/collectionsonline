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

  const finalImageUrl = imageUrl || logoUrl;

  const sortedInfo = {
    ...info,
    ...(viaf && { P214: viaf }),
    ...(oxfordDnb && { P1415: oxfordDnb })
  };

  const wikiData = {
    ...(finalImageUrl && { image: finalImageUrl }),
    ...(JSON.stringify(sortedInfo) !== '{}' && { sortedInfo })
  };

  if (wikiData) {
    wikiInfo.innerHTML = Templates.wikiInfo({ wikiData });
  }

  // handles black logos on black backgrounds

  if (finalImageUrl?.endsWith('svg')) {
    const imgPanel = document.querySelector('.bleed');
    imgPanel.style.backgroundColor = '#ffffff';
  }
};

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
