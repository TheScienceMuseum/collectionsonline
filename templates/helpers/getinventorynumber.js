module.exports = function (details, clean) {
  var accession;
  if (details) {
    Object.keys(details).forEach(el => {
      if (details[el].key === 'Accession Number' || details[el].key === 'Object Number') {
        accession = details[el].value;
      }
    });
  }
  if (accession && clean) {
    return accession;
  } else {
    return accession ? accession + '. ' : '';
  }
};
