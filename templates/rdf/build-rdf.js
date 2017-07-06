var getPrimaryValue = require('../../lib/get-primary-value');

module.exports = function (key, values, type, options) {
  var attributes = {
    'objects': {
      'name': 'object_type',
      'categories': 'category'
    },

    'people': {
      'occupation': 'occupation',
      'nationality': 'nationality'
    },

    'documents': {
      'identifier': 'identifier'
    }
  };

  if (attributes[type] && attributes[type][key]) {
    return options.fn(this, {blockParams: [attributes[type][key], getPrimaryValue(values)]});
  }
};
