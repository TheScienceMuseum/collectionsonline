module.exports = function (details) {
  var accession;
  if (details) {
    Object.keys(details).forEach(el => {
      if (details[el].key === 'Accession Number') {
        accession = details[el].value;
      }
    });
  }

  return accession ? accession + '. ' : '';
};
