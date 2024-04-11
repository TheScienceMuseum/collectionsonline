const test = require('tape');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Sort a list of images by position and date upload(sort priority)', (t) => {
  t.plan(1);

  const images = [
    { position: { value: 1 }, '@processed': { upload_sort: '2016-07-07 10:10:41.0' } },
    { position: { value: 2 }, '@processed': { upload_sort: '2016-07-07' } },
    { position: { value: 1 }, '@processed': { upload_sort: '2015-07-07 10:10:40.0' } },
    { position: { value: 3 }, '@processed': { upload_sort: '2016-07-07' } },
    { '@processed': { upload_sort: '2015-06-06' } },
    { '@processed': { upload_sort: '2015-04-04' } },
    { '@processed': { upload_sort: '2015-05-05' } }
  ];

  const expected = [
    { position: { value: 1 }, '@processed': { upload_sort: '2016-07-07 10:10:41.0' } },
    { position: { value: 1 }, '@processed': { upload_sort: '2015-07-07 10:10:40.0' } },
    { position: { value: 2 }, '@processed': { upload_sort: '2016-07-07' } },
    { position: { value: 3 }, '@processed': { upload_sort: '2016-07-07' } },
    { '@processed': { upload_sort: '2015-06-06' } },
    { '@processed': { upload_sort: '2015-05-05' } },
    { '@processed': { upload_sort: '2015-04-04' } }
  ];

  // Moved to upload_sort 14th April 2024
  // const images = [
  //   { position: { value: 1 }, '@processed': { large: { modified: '2016-07-07 10:10:41.0' } } },
  //   { position: { value: 2 }, '@processed': { large: { modified: '2016-07-07' } } },
  //   { position: { value: 1 }, '@processed': { large: { modified: '2015-07-07 10:10:40.0' } } },
  //   { position: { value: 3 }, '@processed': { large: { modified: '2016-07-07' } } },
  //   { '@processed': { large: { modified: '2015-06-06' } } },
  //   { '@processed': { large: { modified: '2015-04-04' } } },
  //   { '@processed': { large: { modified: '2015-05-05' } } }
  // ];

  // const expected = [
  //   { position: { value: 1 }, '@processed': { large: { modified: '2016-07-07 10:10:41.0' } } },
  //   { position: { value: 1 }, '@processed': { large: { modified: '2015-07-07 10:10:40.0' } } },
  //   { position: { value: 2 }, '@processed': { large: { modified: '2016-07-07' } } },
  //   { position: { value: 3 }, '@processed': { large: { modified: '2016-07-07' } } },
  //   { '@processed': { large: { modified: '2015-06-06' } } },
  //   { '@processed': { large: { modified: '2015-05-05' } } },
  //   { '@processed': { large: { modified: '2015-04-04' } } }
  // ];

  t.deepEqual(sortImages(images), expected, 'The images are sorted by position and date');
  t.end();
});
