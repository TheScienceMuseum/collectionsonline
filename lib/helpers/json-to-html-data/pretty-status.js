module.exports = function (status) {
  const mapping = {
    'permanent collection': 'Permanent collection',
    'loan: wellcome trust': 'Loan: Wellcome Trust',
    'loans: historic': 'Loan',
    loan: 'Loan'
  };

  return mapping[status];
};
