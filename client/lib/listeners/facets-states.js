/**
* State object which represent the display of the facets, open, close or active
* On first load all the facets are closed except the active ones
* The name of the properties must match the data-filter attribute of the div hthml DOM
*/
module.exports = {
  all: {
    Dates: 'close',
    Category: 'close',
    Collection: 'close',
    Maker: 'close',
    Museum: 'close',
    Type: 'close',
    Place: 'close',
    User: 'close',
    Archive: 'close',
    Image: 'close'
  },
  people: {
    Dates: 'close',
    Occupation: 'close',
    'Place born': 'close',
    Organisation: 'close'
  },
  objects: {
    Dates: 'close',
    Category: 'close',
    Collection: 'close',
    Maker: 'close',
    Museum: 'close',
    Type: 'close',
    Place: 'close',
    User: 'close',
    Material: 'close',
    Image: 'close'
  },
  documents: {
    Archive: 'close',
    Maker: 'close',
    Image: 'close'
  }
};
