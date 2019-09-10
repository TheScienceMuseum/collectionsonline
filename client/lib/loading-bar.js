var loadingEl = function () {
  // Attach the loading bar to a different element if on the home page
  return (
    document.querySelector('.home-banner') ||
    document.querySelector('.searchbar')
  );
};

module.exports = {
  start: function() {
    loadingEl().classList.add("c-loading");
  },

  end: function() {
    loadingEl().classList.remove("c-loading");
  }
};
