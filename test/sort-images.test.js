const test = require('tape');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Sort a list of images by priority and date upload(sort pririty)', (t) => {
  t.plan(1);
  const images = [
    {priority: 1, sort: '2015-06-07 13:10:41.0'},
    {priority: 2, sort: '2015-06-07 13:10:41.0'},
    {priority: 1, sort: '2016-06-07 13:10:41.0'},
    {priority: 2, sort: '2015-06-07 16:10:41.0'},
    {priority: 1, sort: '2015-06-07 10:10:40.0'},
    {priority: 1, sort: '2016-07-07'},
    {priority: 1, sort: '2016-07-07'},
    {position: 1, sort: '2016-07-07'},
    {position: 2, sort: '2016-07-07'},
    {position: 1, sort: '2016-07-07'}
  ];

  const expected = [
   {priority: 2, sort: '2015-06-07 16:10:41.0'},
   {priority: 2, sort: '2015-06-07 13:10:41.0'},
   {priority: 1, sort: '2016-07-07'},
   {priority: 1, sort: '2016-07-07'},
   {position: 1, sort: '2016-07-07'},
   {position: 1, sort: '2016-07-07'},
   {position: 2, sort: '2016-07-07'},
   {priority: 1, sort: '2016-06-07 13:10:41.0'},
   {priority: 1, sort: '2015-06-07 13:10:41.0'},
   {priority: 1, sort: '2015-06-07 10:10:40.0'}
  ];

  t.deepEqual(sortImages(images), expected, 'The images are sorted by priority, date and position');
  t.end();
});

