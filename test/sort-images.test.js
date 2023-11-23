const test = require('tape');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Sort a list of images by position, priority and date upload(sort priority)', (t) => {
  t.plan(1);
  const images = [
    { priority: 1, sort: '2015-06-07 13:10:41.0' },
    { priority: 2, sort: '2015-06-07 13:10:41.0' },
    { priority: 1, sort: '2016-06-07 13:10:41.0' },
    { priority: 2, sort: '2015-05-07 16:10:41.0' },
    { priority: 1, sort: '2015-06-07 10:10:40.0' },
    { priority: 1, sort: '2016-07-07' },
    { priority: 1, sort: '2016-07-07' },
    { position: 1, sort: '2016-07-07' },
    { position: 1, sort: '2015-07-07' },
    { position: 2, sort: '2016-07-07' },
    { position: 3, sort: '2016-07-07' },
    { sort: '2015-06-06' },
    { sort: '2015-05-05' }
  ];

  const expected = [
    { position: 1, sort: '2015-07-07' },
    { position: 1, sort: '2016-07-07' },
    { position: 2, sort: '2016-07-07' },
    { position: 3, sort: '2016-07-07' },
    { priority: 2, sort: '2015-05-07 16:10:41.0' },
    { priority: 2, sort: '2015-06-07 13:10:41.0' },
    { priority: 1, sort: '2015-06-07 10:10:40.0' },
    { priority: 1, sort: '2015-06-07 13:10:41.0' },
    { priority: 1, sort: '2016-06-07 13:10:41.0' },
    { priority: 1, sort: '2016-07-07' },
    { priority: 1, sort: '2016-07-07' },
    { sort: '2015-05-05' },
    { sort: '2015-06-06' }
  ];

  t.deepEqual(sortImages(images), expected, 'The images are sorted by position, date and priority');
  t.end();
});
