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

module.exports = () => ({
  method: 'get',
  path: '/wiki/{name}',
  config: {
    handler: (name) => new Promise((resolve, reject) => {
      let url, mainImage, summary;

      return wikijs().page(name)
        .then((page) => {
          url = page.raw.fullurl;
          page.summary()
            .then((summaryRes) => {
              summary = summaryRes;
              page.mainImage()
                .then((mainImageRes) => {
                  mainImage = mainImageRes;

                  resolve({url, mainImage, summary});
                })
                .catch((err) => {
                  const noImageErr = 'Cannot read property \'imageinfo\' of undefined';
                  if (err.message === noImageErr) {
                    resolve({url, summary});
                  } else {
                    reject(err);
                  }
                });
            })
            .catch(reject);
        })
        .catch(reject);
    })
  }
});
