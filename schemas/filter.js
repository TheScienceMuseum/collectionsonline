const Joi = require('joi');
const dateSchema = require('./date');

const sharedSchema = {
  // All
  'filter[date[from]]': dateSchema.empty(''),
  'filter[date[to]]': dateSchema.empty(''),
  // Objects
  'filter[on_display]': Joi.boolean(),
  // People
  'filter[birth[date]]': dateSchema.empty(''),
  'filter[death[date]]': dateSchema.empty('')
  // Documents
};

const jsonSchema = {
  // All
  'filter[places]': Joi.string(),
  // Objects
  'filter[type]': Joi.string(),
  'filter[makers]': Joi.string(),
  'filter[people]': Joi.string(),
  'filter[organisations]': Joi.string(),
  'filter[categories]': Joi.string(),
  'filter[museum]': Joi.string().valid('NRM', 'SMG', 'NMeM', 'MSI'),
  'filter[location]': Joi.string(),
  'filter[user]': Joi.string(),
  // People
  'filter[birth[place]]': Joi.string(),
  'filter[occupation]': Joi.string(),
  // Documents
  'filter[archive]': Joi.string(),
  'filter[formats]': Joi.string(),
  'filter[image_licences]': Joi.string()
};

const htmlSchema = {
  // All
  'filter[places]': Joi.array().items(Joi.string()).single(),
  // Objects
  'filter[type]': Joi.array().items(Joi.string()).single(),
  'filter[makers]': Joi.array().items(Joi.string()).single(),
  'filter[people]': Joi.array().items(Joi.string()).single(),
  'filter[organisations]': Joi.array().items(Joi.string()).single(),
  'filter[categories]': Joi.array().items(Joi.string()).single(),
  'filter[museum]': Joi.string().valid('NRM', 'SMG', 'NMeM', 'MSI'),
  'filter[location]': Joi.array().items(Joi.string()).single(),
  'filter[user]': Joi.array().items(Joi.string()).single(),
  // People
  'filter[birth[place]]': Joi.array().items(Joi.string()).single(),
  'filter[occupation]': Joi.array().items(Joi.string()).single(),
  // Documents
  'filter[archive]': Joi.array().items(Joi.string()).single(),
  'filter[formats]': Joi.array().items(Joi.string()).single(),
  'filter[image_licences]': Joi.array().items(Joi.string()).single()
};

module.exports = (contentType) => {
  var schema;

  if (contentType === 'json') {
    schema = Object.assign(sharedSchema, jsonSchema);
  }

  if (contentType === 'html') {
    schema = Object.assign(sharedSchema, htmlSchema);
  }

  return Joi.object()
    .keys(schema)
    .rename('date[from]', 'filter[date[from]]', {override: true, ignoreUndefined: true})
    .rename('date[to]', 'filter[date[to]]', {override: true, ignoreUndefined: true})
    .rename('places', 'filter[places]', {override: true, ignoreUndefined: true})
    .rename('type', 'filter[type]', {override: true, ignoreUndefined: true})
    .rename('makers', 'filter[makers]', {override: true, ignoreUndefined: true})
    .rename('people', 'filter[people]', {override: true, ignoreUndefined: true})
    .rename('organisations', 'filter[organisations]', {override: true, ignoreUndefined: true})
    .rename('categories', 'filter[categories]', {override: true, ignoreUndefined: true})
    .rename('museum', 'filter[museum]', {override: true, ignoreUndefined: true})
    .rename('on_display', 'filter[on_display]', {override: true, ignoreUndefined: true})
    .rename('location', 'filter[location]', {override: true, ignoreUndefined: true})
    .rename('birth[place]', 'filter[birth[place]]', {override: true, ignoreUndefined: true})
    .rename('birth[date]', 'filter[birth[date]]', {override: true, ignoreUndefined: true})
    .rename('death[date]', 'filter[death[date]]', {override: true, ignoreUndefined: true})
    .rename('occupation', 'filter[occupation]', {override: true, ignoreUndefined: true})
    .rename('archive', 'filter[archive]', {override: true, ignoreUndefined: true})
    .rename('formats', 'filter[formats]', {override: true, ignoreUndefined: true})
    .rename('image_licences', 'filter[image_licences]', {override: true, ignoreUndefined: true})
    .rename('user', 'filter[user]', {override: true, ignoreUndefined: true});
};
