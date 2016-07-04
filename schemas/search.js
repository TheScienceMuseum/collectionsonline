const Joi = require('joi');

module.exports = {
  q: Joi.string().required(),
  'page[number]': Joi.number().integer().min(0),
  'page[size]': Joi.number().integer().min(1),
  'fields[type]': Joi.string().valid('objects', 'people', 'documents')
};
