module.exports = function (status) {
  var mapping = {
    'permanent collection': 'Permanent collection',
    'loan: wellcome trust': 'Loan: Wellcome Trust',
    'loans: historic': 'Loan',
    'loan': 'Loan'
  };

  return mapping[status];
};
