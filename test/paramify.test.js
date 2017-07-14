var test = require('tape');
var paramify = require('../lib/helpers/paramify.js');
var dir = __dirname.split('/')[__dirname.split('/').length - 1];
var file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'paramify transforms query', (t) => {
  var query = {
    has_image: true,
    categories: 'Art'
  };

  t.equal(paramify(query), '/images/categories/art', 'Query becomes param string');
  t.end();
});
