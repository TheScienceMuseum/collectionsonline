const Joi = require('joi');

module.exports = {
  'expanded': Joi.array().items(Joi.string().regex(/\bsmg[ac]-documents-\d+\b/)).single()
};
