module.exports = {
  title: 'Science Museum Group Collection',
  titlePage: 'Science Museum Group Collection',
  strap: 'Search our collection',
  intro:
    'Explore over 250,000 <a href="/search/objects">objects</a> and <a href="/search/documents">archives</a> from the <a href="/search/museum/science-museum">Science Museum</a>, <a href="/search/museum/museum-of-science-and-industry">Museum of Science and Industry</a>, <a href="/search/museum/national-media-museum">National Science and Media Museum</a> and <a href="/search/museum/national-railway-museum">National Railway Museum</a>.',
  headerImages: [
    '_D819175-ret.jpg',
    '1970-0025_0007.jpg',
    '_D818504.jpg',
    'textile-sign.jpg',
    'switches.jpg',
    '_D817130-Edit2.jpg',
    '1878-0005_0004_A163_0002.jpg',
    'cd0634_030_100924_1988_242.jpg'
  ],
  collectionGroup: [
    {
      title: 'See what’s on display',
      collection: [
        {
          type: 'collection',
          title: 'Science Museum',
          description:
            'The home of human ingenuity, exploring stories of scientific achievement',
          figure: '/assets/img/home/collections/sciencemuseum.jpg',
          columns: 'small-6 medium-3',
          link: '/search/museum/science-museum'
        },
        {
          type: 'collection',
          title: 'Museum of Science and Industry',
          figure: '/assets/img/home/collections/msi.jpg',
          description:
            'The story of Manchester’s scientific and industrial past, present and future',
          columns: 'small-6 medium-3',
          link: '/search/museum/museum-of-science-and-industry'
        },
        {
          type: 'collection',
          title: 'National Science and Media Museum',
          figure: '/assets/img/home/collections/nmm.jpg',
          description:
            'The science and culture of light and sound technologies, and their impact on our lives',
          columns: 'small-6 medium-3',
          link: '/search/museum/national-media-museum'
        },
        {
          type: 'collection',
          title: 'National Railway Museum',
          figure: '/assets/img/home/collections/nrm.jpg',
          description:
            'Home to the largest collection of railway objects in the world',
          columns: 'small-6 medium-3',
          link: '/search/museum/national-railway-museum'
        }
      ]
    },
    {
      title: 'Themes from our collection',
      collection: [
        {
          type: 'collection',
          title: 'Information Age',
          description:
            'Search across a snapshot of objects representing the development of the internet',
          figure: '/assets/img/home/collections/informationage.jpg',
          columns: 'small-6 medium-3',
          link: '/search/gallery/information-age-gallery%3A-web'
        },
        {
          type: 'collection',
          title: 'Cinematography',
          figure: '/assets/img/home/collections/cinematography.jpg',
          description:
            'Objects representing the history of cinema: from magic lanterns to digital technologies',
          columns: 'small-6 medium-3',
          link: '/search/categories/cinematography/images'
        },
        {
          type: 'collection',
          title: 'The Babbage Papers',
          figure: '/assets/img/home/collections/babbage.jpg',
          description:
            'The drawings and papers of mathematician and computer pioneer Charles Babbage',
          columns: 'small-6 medium-3',
          link: '/documents/aa110000003/the-babbage-papers'
        },
        {
          type: 'collection',
          title: 'Railway Photographic Collection',
          figure:
            '/assets/img/home/collections/railway-photographic-collections.jpg',
          description:
            'Explore railway history\u2014from technological to social change\u2014using our photographic collection',
          columns: 'small-6 medium-3',
          link: '/search/categories/photographic-collections-(railway)/images'
        }
        /*
    {
      type: 'collection',
      title: 'Railway Posters',
      description: 'Explore our collection of historic railway posters',
      figure: '/assets/img/home/collections/railway-posters.jpg',
      columns: 'small-6 medium-3',
      link: '/search/images/categories/railway-posters,-notices-&-handbills'
    }
    */
      ]
    }
  ]
};
