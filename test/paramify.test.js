const test = require('tape');
const paramify = require('../lib/helpers/paramify.js');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'paramify transforms query', (t) => {
  const query = {
    has_image: true,
    categories: 'Art'
  };

  t.equal(paramify(query), '/images/categories/art', 'Query becomes param string');
  t.end();
});
