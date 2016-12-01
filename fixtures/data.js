module.exports = {
  title: 'Science Museum Group Collection',
  titlePage: 'Science Museum Group Collection',
  strap: 'Search our collection',
  intro: 'Explore over 150,000 objects and archives from the Science Museum, Museum of Science and Industry, National Media Museum and National Railway Museum.',
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
      title: 'Museum of Science & Industry',
      figure: '/assets/img/home/collections/msi.jpg',
      description: 'The story of Manchester’s scientific and industrial past, present and future',
      columns: 'small-6 medium-3',
      link: '/msi'
    }, {
      type: 'collection',
      title: 'National Media Museum',
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
      title: 'Locomotives and Rolling Stock',
      description: 'Search within 280 locomotives and rolling stock from the collection',
      figure: '/assets/img/example/collections/railways.jpg',
      columns: 'small-6 medium-3',
      link: '/search?filter[categories]=Locomotives and Rolling Stock'
    }, {
      type: 'collection',
      title: 'Art',
      figure: '/assets/img/home/collections/art.jpg',
      description: 'Artworks depicting the history of science, technology and medicine over time',
      columns: 'small-6 medium-3',
      link: '/search?filter[categories]=Art'
    }, {
      type: 'collection',
      title: 'The Babbage Papers',
      figure: '/assets/img/home/collections/babbage.jpg',
      description: 'The drawings and papers of mathematician and computer pioneer Charles Babbage',
      columns: 'small-6 medium-3',
      link: '/search/documents?filter[archive]=The Babbage Papers'
    }, {
      type: 'collection',
      title: 'Mathematics',
      description: 'Explore the objects in Mathematics: The Winton Gallery ',
      figure: '/assets/img/home/collections/mathematics.jpg',
      columns: 'small-6 medium-3',
      link: '/search?filter[gallery]=Winton Mathematics Gallery'
    }]
  }]
};
