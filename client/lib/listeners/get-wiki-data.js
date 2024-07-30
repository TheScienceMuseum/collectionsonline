const getData = require('../get-data');
const Templates = require('../../templates');
module.exports = async function () {
  const wikiImage = document.getElementById('wikiImage');
  const wikiInfo = document.getElementById('wikiInfo');
  const data = await displayData();
  if (!data) {
    return;
  }

  const { P18: imageUrl = null, P154: logoUrl = null, ...info } = data;
  const finalImageUrl = imageUrl || logoUrl;
  if (finalImageUrl) {
    wikiImage.innerHTML = Templates.wikiImage({ finalImageUrl });
  }
  // handles black logos on black background
  if (finalImageUrl.endsWith('svg')) {
    const imgPanel = document.querySelector('.bleed');
    imgPanel.style.backgroundColor = '#ffffff';
  }

  if (JSON.stringify(info) !== '{}') {
    wikiInfo.innerHTML = Templates.wikiInfo({ info });
  }
};

async function displayData () {
  const wikiImage = document.getElementById('wikiImage');
  const wikiInfo = document.getElementById('wikiInfo');
  const url = wikiImage?.dataset.name
    ? '/wiki/' + wikiImage?.dataset.name
    : '/wiki/' + wikiInfo?.dataset.name;

  const hasWikiImage = !!wikiImage;
  const hasWikiInfo = !!wikiInfo;

  if (!hasWikiImage || !hasWikiInfo) {
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
