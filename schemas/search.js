const Joi = require('joi');

module.exports = {
  query: {
    q: Joi.string().allow(''),
    'page[number]': Joi.number().integer().min(0),
    'page[size]': Joi.number().integer().min(1),
    'page[type]': Joi.string().valid('search', 'results-list'),
    // 'fields[type]': Joi.string().valid('objects', 'people', 'documents'),
    'ajax': Joi.boolean()
  }
};
