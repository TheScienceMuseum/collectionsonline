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
    handler: (req, reply) => {
      let url, mainImage, summary, title;

      wikijs().page(req.params.name)
        .then((page) => {
          url = page.raw.fullurl;
          title = page.raw.title;
          page.summary()
            .then((summaryRes) => {
              summary = summaryRes;
              page.mainImage()
                .then((mainImageRes) => {
                  mainImage = mainImageRes;

                  reply({url, mainImage, summary, title});
                })
                .catch((err) => {
                  const noImageErr = 'Cannot read property \'imageinfo\' of undefined';
                  if (err.message === noImageErr) {
                    reply({url, summary, title});
                  } else {
                    reply(err);
                  }
                });
            })
            .catch(reply);
        })
        .catch(reply);
    }
  }
});
