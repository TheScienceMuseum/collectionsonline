const Joi = require('joi');
const dateSchema = require('./date');

module.exports = Joi.object()
  .keys({
    // All
    'date[from]': dateSchema,
    'date[to]': dateSchema,
    places: Joi.array().items(Joi.string()).single(),
    // Objects
    type: Joi.string(),
    makers: Joi.array().items(Joi.string()).single(),
    people: Joi.array().items(Joi.string()).single(),
    organisations: Joi.array().items(Joi.string()).single(),
    categories: Joi.array().items(Joi.string()).single(),
    museum: Joi.string().valid('NRM', 'SMG', 'NMeM', 'MSI'),
    on_display: Joi.boolean(),
    location: Joi.string(),
    // People
    'birth[place]': Joi.string(),
    'birth[date]': dateSchema,
    'death[date]': dateSchema,
    occupation: Joi.string(),
    // Documents
    archive: Joi.string(),
    formats: Joi.string(),
    image_licences: Joi.string()
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
