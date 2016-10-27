module.exports = {
  start: function () {
    document.querySelector('.searchbar').classList.add('loading');
  },

  end: function () {
    document.querySelector('.searchbar').classList.remove('loading');
  }
};
