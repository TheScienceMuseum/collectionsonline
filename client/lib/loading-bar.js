var loadingEl = function () {
  // Attach the loading bar to a different element if on the home page
  return (
    document.querySelector('.home-banner') ||
    document.querySelector('.searchbar')
  );
};

module.exports = {
  start: function () {
    loadingEl().classList.add('loading');
  },

  end: function () {
    loadingEl().classList.remove('loading');
  }
};
