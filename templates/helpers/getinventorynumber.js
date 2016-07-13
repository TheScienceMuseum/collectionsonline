module.exports = function (details) {
  var accession;

  Object.keys(details).forEach(el => {
    if (details[el].key === 'Accession Number') {
      accession = details[el].value;
    }
  });

  return accession ? accession + '. ' : '';
};
