module.exports = {
  title: 'Science Museum Group Collection',
  titlePage: 'Science Museum Group Collection',
  strap: 'Search our collection',
  intro: 'Explore over 250,000 objects and archives from the Science Museum, Museum of Science and Industry, National Science and Media Museum and National Railway Museum.',
  headerImages: [
    'handley.jpg',
    'textile-sign.jpg',
    'switches.jpg',
    '1878-0005_0004_A163_0002.jpg',
    'cd0634_030_100924_1988_242',
    'cd0274_008_070301.jpg'
  ],
  collectionGroup: [{
    title: 'See what’s on display',
    collection: [{
      type: 'collection',
      title: 'Science Museum',
      description: 'The home of human ingenuity, exploring stories of scientific achievement',
      figure: '/assets/img/home/collections/sciencemuseum.jpg',
      columns: 'small-6 medium-3',
      link: '/scm'
    }, {
      type: 'collection',
      title: 'Museum of Science and Industry',
      figure: '/assets/img/home/collections/msi.jpg',
      description: 'The story of Manchester’s scientific and industrial past, present and future',
      columns: 'small-6 medium-3',
      link: '/msi'
    }, {
      type: 'collection',
      title: 'National Science and Media Museum',
      figure: '/assets/img/home/collections/nmm.jpg',
      description: 'The science and culture of light and sound technologies, and their impact on our lives',
      columns: 'small-6 medium-3',
      link: '/nmem'
    }, {
      type: 'collection',
      title: 'National Railway Museum',
      figure: '/assets/img/home/collections/nrm.jpg',
      description: 'Home to the largest collection of railway objects in the world',
      columns: 'small-6 medium-3',
      link: '/nrm'
    }]
  }, {
    title: 'Themes from our collection',
    collection: [{
      type: 'collection',
      title: 'Information Age',
      description: 'Search across a snapshot of objects representing the development of the internet',
      figure: '/assets/img/home/collections/informationage.jpg',
      columns: 'small-6 medium-3',
      link: '/search?filter%5Bmuseum%5D=Science%20Museum&filter%5Bgallery%5D=Information%20Age%20Gallery%3A%20Web&page%5Bsize%5D=50&page%5Btype%5D=search'
    }, {
      type: 'collection',
      title: 'Cinematography',
      figure: '/assets/img/home/collections/cinematography.jpg',
      description: 'Objects representing the history of cinema: from magic lanterns to digital technologies',
      columns: 'small-6 medium-3',
      link: '/search?filter%5Bhas_image%5D=true&filter%5Bcategories%5D=Cinematography&page%5Bsize%5D=50&page%5Btype%5D=search'
    }, {
      type: 'collection',
      title: 'The Babbage Papers',
      figure: '/assets/img/home/collections/babbage.jpg',
      description: 'The drawings and papers of mathematician and computer pioneer Charles Babbage',
      columns: 'small-6 medium-3',
      link: '/documents/aa110000003/the-babbage-papers'
    }, {
      type: 'collection',
      title: 'Mathematics',
      description: 'Explore the objects in Mathematics: The Winton Gallery ',
      figure: '/assets/img/home/collections/mathematics.jpg',
      columns: 'small-6 medium-3',
      link: '/search?filter[gallery]=Mathematics:%20The%20Winton%20Gallery&filter[museum]=Science%20Museum'
    }]
  }]
};
