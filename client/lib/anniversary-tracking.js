module.exports = function initAnniversaryTracking () {
  document.addEventListener('click', function (e) {
    const card = e.target.closest('[data-anniversary-type]');
    if (!card) return;

    const type = card.getAttribute('data-anniversary-type');
    const id = card.getAttribute('data-anniversary-id');
    if (!type || !id) return;

    const label = type + ':' + id;

    // Push to GTM dataLayer (primary analytics method in this project)
    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'anniversary_click',
        eventCategory: 'anniversary-widget',
        eventAction: 'click',
        eventLabel: label
      });
    }
  });
};
