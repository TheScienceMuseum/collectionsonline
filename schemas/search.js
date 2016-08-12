const Joi = require('joi');

module.exports = {
  q: Joi.string(),
  'page[number]': Joi.number().integer().min(0),
  'page[size]': Joi.number().integer().min(1),
  'page[type]': Joi.string().valid('search', 'results-list'),
  'fields[type]': Joi.string().valid('objects', 'people', 'documents')
};
