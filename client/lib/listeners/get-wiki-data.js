const getData = require('../get-data');
const Templates = require('../../templates');
const { getImageUrl } = require('../wikidataQueries');
const initiateWikidataRequest = require('./wikidataReq');
module.exports = async function () {
  const wikiImage = document.getElementById('wikiImage');
  const qCode = wikiImage.dataset.name;
  const data = await displayData();
  const { entities } = data;
  const imageUrl = await getImageUrl(entities, qCode);

  const image = imageUrl
    ? {
        imageUrl
      }
    : {};

  if (data && imageUrl) {
    wikiImage.innerHTML = Templates.wikiImage(image);
  }
};

// async function displayData () {
//   const wikiImage = document.getElementById('wikiImage');
//   const qCode = '/wiki/' + wikiImage.dataset.name;

//   return new Promise(async (resolve, reject) => {
//     try {
//       const url = await initiateWikidataRequest(qCode);
//       const opts = {
//         headers: { Accept: 'application/vnd.api+json' }
//       };

//       getData(url, opts, function (_err, data) {
//         if (_err) {
//           reject(_err);
//         } else {
//           resolve(data);
//         }
//       });
//     } catch (error) {
//       console.error('Error checking the URL or getting data:', error);
//       reject(error);
//     }
//   });
// }
async function displayData () {
  const wikiImage = document.getElementById('wikiImage');
  const qCode = '/wiki/' + wikiImage.dataset.name;

  try {
    const url = await initiateWikidataRequest(qCode);
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
