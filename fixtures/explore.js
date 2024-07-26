const mockTopic = {
  // this can match the template-data format of results from the API
  type: 'group',
  title: 'TEST COVID19',
  category: undefined,
  date: null,
  figure: null,
  collage: [
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/518/422/medium_thumbnail_2021_0596__0002_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/525/636/medium_thumbnail_2021_1624__0013_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/713/732/medium_thumbnail_2022_0200__0003_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/539/809/medium_thumbnail_2021_0421__0004_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/720/744/medium_thumbnail_2022_0022__0002_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/518/422/medium_thumbnail_2021_0596__0002_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/525/636/medium_thumbnail_2021_1624__0013_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/713/732/medium_thumbnail_2022_0200__0003_.jpg',
    'https://smgco7-media.s3.eu-west-1.amazonaws.com/539/809/medium_thumbnail_2021_0421__0004_.jpg'
  ],
  figcaption: 'TEST VALUE IN NOTE',
  link: 'http://localhost:8000/group/c81734/test-covid19'
};

// for each theme:
const mockTheme = {
  title: 'CO 2.0 Test',
  description: 'description1',
  link: '/search/group/subgroup/co-2.0-test',
  figure: null, // don't think themes have images assigned to them currently, but given their finite and editorial nature, they could? all looks a bit nothing without an image...
  figcaption: 'TEST VALUE IN NOTE'
};

module.exports = {
  strap: 'Explore our collection',
  intro:
    'Where to start? Our museum curators have researched some themes and topics to help you explore over 380,000 <a href="/search/objects">objects</a> and <a href="/search/documents">archives</a> from the collection.',
  headerImages: [
    'IMG_7224.jpg', 'IMG_7231.jpg', 'IMG_7298.jpg' // update /client/styles/components/_explore.scss if no of images changes
  ],
  featured: [{
    title: 'The first featured theme',
    description: 'Featured themes as carousels. First one is on dark.',
    link: 'http://localhost:8000/search/group/subgroup/co-2.0-test',
    topics: Array(8).fill(mockTopic)
  },
  {
    title: 'featured theme 2',
    description: 'Subsequent featured themes are on lighter bg.',
    link: 'http://localhost:8000/search/group/subgroup/co-2.0-test',
    topics: Array(8).fill(mockTopic)
  }],
  themes: Array(11).fill(mockTheme)
};
