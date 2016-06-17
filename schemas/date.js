const Joi = require('joi');

module.exports = Joi.alternatives().try(
  Joi.date().format('YYYY-MM-DD'),
  Joi.date().format('YYYY-MM'),
  Joi.date().format('YYYY')
);
