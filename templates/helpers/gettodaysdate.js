module.exports = () => {
  var months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  var today = new Date();

  return today.getDate() + ' ' + months[today.getMonth()] + ' ' + today.getFullYear();
};
