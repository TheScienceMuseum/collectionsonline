const Joi = require('joi');
const dateSchema = require('./date');

module.exports = Joi.object()
  .keys({
    // All
    'filter[date[from]]': dateSchema,
    'filter[date[to]]': dateSchema,
    'filter[places]': Joi.array().items(Joi.string()).single(),
    // Objects
    'filter[type]': Joi.string(),
    'filter[makers]': Joi.array().items(Joi.string()).single(),
    'filter[people]': Joi.array().items(Joi.string()).single(),
    'filter[organisations]': Joi.array().items(Joi.string()).single(),
    'filter[categories]': Joi.array().items(Joi.string()).single(),
    'filter[museum]': Joi.string().valid('NRM', 'SMG', 'NMeM', 'MSI'),
    'filter[on_display]': Joi.boolean(),
    'filter[location]': Joi.string(),
    // People
    'filter[birth[place]]': Joi.string(),
    'filter[birth[date]]': dateSchema,
    'filter[death[date]]': dateSchema,
    'filter[occupation]': Joi.string(),
    // Documents
    'filter[archive]': Joi.string(),
    'filter[formats]': Joi.array().items(Joi.string()).single(),
    'filter[image_licences]': Joi.array().items(Joi.string()).single()
  })
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
  .rename('image_licences', 'filter[image_licences]', {override: true, ignoreUndefined: true});
