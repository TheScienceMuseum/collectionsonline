const getData = require('../get-data');
const Templates = require('../../templates');

module.exports = function () {
  const el = document.getElementById('aiBiography');
  if (!el) return;

  const personId = el.dataset.personId;
  if (!personId) return;

  const url = '/ai/biography/' + personId;
  const opts = {
    headers: { Accept: 'application/json' }
  };

  getData(url, opts, function (err, data) {
    if (err || !data || !data.biography) {
      el.style.display = 'none';
      return;
    }

    const hasWikidata = data.sources && data.sources.indexOf('wikidata') !== -1;

    el.innerHTML = Templates.aiBiography({
      biography: data.biography,
      context: data.context || '',
      personName: data.personName || 'this person',
      hasWikidata,
      flagEnabled: !!data.flagEnabled,
      personId
    });

    // If existing description is very short, suppress it
    if (data.suppressExisting) {
      const descBlock = document.querySelector('.record-description');
      if (descBlock) {
        descBlock.style.display = 'none';
      }
    }

    // Wire up the flag widget, if the feature is enabled and it rendered.
    if (data.flagEnabled) {
      attachFlagWidget(el, personId);
    }
  });
};

/**
 * Attach expand/collapse + submit behaviour to the "Report a problem" widget.
 * If the visitor has already flagged this record (cookie set on previous
 * successful submission), hide the widget entirely — it's a UX hint only,
 * server-side dedup isn't guaranteed.
 */
function attachFlagWidget (container, personId) {
  const widget = container.querySelector('.ai-biography-flag');
  if (!widget) return;

  if (hasAlreadyFlaggedCookie(personId)) {
    widget.hidden = true;
    return;
  }

  const trigger = widget.querySelector('.ai-biography-flag__trigger');
  const form = widget.querySelector('.ai-biography-flag__form');
  const thanks = widget.querySelector('.ai-biography-flag__thanks');
  const errorMsg = widget.querySelector('.ai-biography-flag__error');
  const reasonSelect = widget.querySelector('.ai-biography-flag__reason');
  const submitBtn = widget.querySelector('.ai-biography-flag__submit');

  if (!trigger || !form) return;

  // Disclosure toggle — the trigger stays visible at all times, doubling as
  // a label for the form when open. Click again to close; pairs with
  // aria-expanded for screen-reader accessibility.
  trigger.addEventListener('click', function () {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      form.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      form.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (reasonSelect) reasonSelect.focus();
    }
  });

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    errorMsg.hidden = true;

    // Honeypot check in-browser too — if a bot filled it in via automation,
    // just silently "succeed" without calling the server.
    const honeypotInput = form.querySelector('input[name="website"]');
    if (honeypotInput && honeypotInput.value) {
      showThanks();
      return;
    }

    const reason = reasonSelect ? reasonSelect.value : '';
    if (!reason) return;

    submitBtn.disabled = true;

    try {
      const res = await window.fetch('/ai/biography/' + personId + '/flag', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      showThanks();
    } catch (err) {
      submitBtn.disabled = false;
      errorMsg.hidden = false;
    }
  });

  function showThanks () {
    // After successful submission: hide the form + the trigger entirely,
    // show the thank-you message. Visitor can't submit again from this
    // browser (cookie already set server-side).
    form.hidden = true;
    const promptEl = widget.querySelector('.ai-biography-flag__prompt');
    if (promptEl) promptEl.hidden = true;
    thanks.hidden = false;
  }
}

function hasAlreadyFlaggedCookie (personId) {
  const name = 'aiFlagged_' + personId + '=';
  const cookies = (document.cookie || '').split(';');
  for (let i = 0; i < cookies.length; i++) {
    if (cookies[i].trim().indexOf(name) === 0) return true;
  }
  return false;
}
