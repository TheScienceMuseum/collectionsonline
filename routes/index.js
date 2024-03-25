module.exports = (elastic, config) => [
  require('./redirects').random(),
  require('./redirects').medicine(),
  require('./redirects').dailyherald(config),
  require('./redirects').dailyheraldarchive(config),
  require('./home')(config),
  require('./search')(elastic, config),
  require('./public')(config),
  require('./archive')(elastic, config),
  require('./object')(elastic, config),
  require('./person')(elastic, config),
  require('./autocomplete')(elastic, config),
  require('./sitemap')(config),
  require('./analytics')(),
  require('./museum').scm(),
  require('./museum').msi(),
  require('./museum').nmem(),
  require('./museum').nrm(),
  require('./api')(elastic, config),
  require('./iiif')(elastic, config),
  require('./object-id')(elastic, config),
  require('./robot')(config),
  require('./articles')(config),
  require('./wiki')(config),
  require('./embed').rotational(elastic, config),
  require('./embed').rotationalDirect(),
  require('./about')(config),
  require('./stats')(elastic, config),
  require('./categories')(elastic, config),
  require('./collections')(elastic, config),
  require('./imgtags')(elastic, config),
  require('./neverbeenseen')(elastic, config),
  require('./barcode')(elastic, config),
  require('./group')(elastic, config),
];
