module.exports = function (records, priority) {
  return records.filter(record => record?.priority === priority);
};
