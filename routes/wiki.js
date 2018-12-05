const wikijs = require('wikijs').default;

/**
 * wikipedia('Babbage')
 *   .then(console.log) // {url: http://, mainImage: 'http://', summary: 'summary...'}
 *   .catch((err) => console.log('Error: ', err));
 *
 * wikipedia('John_Smith_(anatomist_and_chemist)')
 *   .then(console.log)
 *   .catch((err) => console.log('Error: ', err));
 */

const wikipedia = (name) => new Promise((resolve, reject) => {
  var url, mainImage, infoBox, summary, title;

  wikijs().page(name)
    .then((page) => {
      url = page.raw.fullurl;
      title = page.raw.title;
      page.summary()
        .then((summaryRes) => {
          summary = summaryRes;
          page.fullInfo()
            .then((infoBoxRes) => {
              infoBox = infoBoxRes;
              if (!infoBox.general.caption) { infoBox.general.caption = 'Third party image from Wikimedia Commons'; }
              page.mainImage()
                .then((mainImageRes) => {
                  mainImage = mainImageRes;
                  console.log(mainImage);
                  resolve({url, mainImage, infoBox, summary, title});
                })
                .catch((err) => {
                  const noImageErr = 'Cannot read property \'imageinfo\' of undefined';
                  if (err.message === noImageErr) {
                    resolve({url, infoBox, summary, title});
                  }
                })
                .catch(reject);
            })
            .catch(reject);
        })
        .catch(reject);
    })
    .catch(reject);
});

module.exports = (config) => ({
  method: 'get',
  path: '/wiki/{name}',
  config: {
    handler: (req, reply) => {
      var inProduction = config && config.NODE_ENV === 'production';

      if (!inProduction) {
        return wikipedia(req.params.name).then(reply);
      }
      return reply();
    }
  }
});
