const Joi = require('joi');

module.exports = {
  query: {
    q: Joi.string().allow(''),
    'page[number]': Joi.number().integer().min(0),
    'page[size]': Joi.number().integer().min(1),
    'page[type]': Joi.string().valid('search', 'results-list'),
    'ajax': Joi.boolean().truthy('true').falsy('false')
  }
};
