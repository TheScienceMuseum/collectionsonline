module.exports = (details) => {
  var accession = details.find(el => el.key === 'Accession Number');
  return accession ? accession.value + '. ' : '';
};
