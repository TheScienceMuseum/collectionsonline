module.exports = {
  all: [
    'filter[date[from]]',
    'filter[date[to]]',
    'filter[categories]',
    'filter[makers]',
    'filter[object_type]',
    'filter[places]',
    'filter[user]',
    'filter[has_image]',
    'filter[image_license]',
    'filter[rotational]'
  ],
  people: [
    'filter[birth[date]]',
    'filter[death[date]]',
    'filter[occupation]',
    'filter[birth[place]]',
    'filter[organisations]'
  ],
  objects: [
    'filter[date[from]]',
    'filter[date[to]]',
    'filter[categories]',
    'filter[collection]',
    'filter[makers]',
    'filter[object_type]',
    'filter[material]',
    'filter[places]',
    'filter[user]',
    'filter[material]',
    'filter[has_image]',
    'filter[image_license]',
    'filter[rotational]',
    'filter[mphc]'
  ],
  documents: [
    'filter[archive]',
    'filter[organisations]',
    'filter[has_image]',
    'filter[image_license]'
  ],
  group: ['filter[subgroup]']
};
