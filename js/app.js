/**
 * Church Connect — Phase 1 app logic.
 * Depends on: config.js, validation.js, api.js, motion.js (loaded before this file).
 */
(function () {
  'use strict';

  const cfg = window.CHURCH_CONNECT_CONFIG;
  const V = window.CCValidation;
  const API = window.CCApi;
  const FX = window.CCMotion;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const form = $('#regForm');
  const els = {
    typeSelector: $('#typeSelector'),
    typeThumb: $('#typeThumb'),
    formCard: $('#formCard'),
    success: $('#successPanel'),
    submitBtn: $('#submitBtn'),
    submitLabel: $('#submitLabel'),
    spinner: $('#submitBtn .spin'),
    alert: $('#formAlert'),
    banner: $('#setupBanner'),
    methodField: $('#methodField'),
    phoneHint: $('#hint-phone'),
    recentList: $('#recentList'),
    recentEmpty: $('#recentEmpty'),
    clearRecent: $('#clearRecent')
  };

  const RECENT_KEY = 'cc.recent.v1';
  const state = { type: 'Newcomer', submitting: false, registrationId: newId(), recent: loadRecent() };

  /* ---------- helpers ---------- */

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function loadRecent() {
    try {
      const raw = sessionStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecent() {
    try {
      sessionStorage.setItem(RECENT_KEY, JSON.stringify(state.recent.slice(0, 20)));
    } catch (e) {
      /* storage unavailable: list simply won't survive a refresh */
    }
  }

  function fillSelect(select, items) {
    items.forEach((item) => {
      const o = document.createElement('option');
      o.value = item;
      o.textContent = item;
      select.appendChild(o);
    });
  }

  function radioValue(name) {
    const r = form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : '';
  }

  /* ---------- setup ---------- */

  function setupBranding() {
    const name = cfg.CHURCH_NAME || 'Your Church Name';
    $('#churchName').textContent = name;
    document.title = 'Church Connect | ' + name;
  }

  function setupOptions() {
    $$('select[data-options]').forEach((sel) => fillSelect(sel, cfg[sel.dataset.options] || []));
    if (!cfg.BRANCHES || !cfg.BRANCHES.length) $('#branchField').hidden = true;
    const dl = $('#deptList');
    (cfg.DEPARTMENTS || []).forEach((d) => {
      const o = document.createElement('option');
      o.value = d;
      dl.appendChild(o);
    });
    form.elements.serviceDate.value = V.todayLocal();
    form.elements.serviceDate.max = V.todayLocal();
  }

  function setupMode() {
    const mode = API.mode();
    if (mode === 'unconfigured') {
      els.banner.hidden = false;
      els.banner.dataset.tone = 'warn';
      els.banner.innerHTML =
        '<strong>Google Sheets isn’t connected yet.</strong> Paste your Apps Script URL into <code>js/config.js</code> to start saving. ' +
        'To try the form without saving, add <code>?demo=1</code> to the web address.';
      els.submitBtn.disabled = true;
      els.submitLabel.textContent = 'Connect Google Sheets to save';
      setStatus('warn', 'Not connected');
    } else if (mode === 'demo') {
      els.banner.hidden = false;
      els.banner.dataset.tone = 'demo';
      els.banner.innerHTML = '<strong>Demo mode.</strong> Nothing you enter here is saved to Google Sheets.';
      setStatus('demo', 'Demo mode');
    } else {
      setStatus('checking', 'Checking connection');
      API.ping().then((r) => {
        if (r.ok) setStatus('ok', 'Google Sheets connected');
        else setStatus('error', 'Can’t reach Google Sheets');
      });
    }
  }

  function setStatus(stateName, text) {
    $('#statusPill').dataset.state = stateName;
    $('#statusText').textContent = text;
  }

  /* ---------- registration type selector ---------- */

  function positionThumb(instant) {
    const selected = $('.type-option.is-selected', els.typeSelector);
    if (!selected) return;
    FX.moveThumb(
      els.typeThumb,
      { left: selected.offsetLeft, top: selected.offsetTop, width: selected.offsetWidth, height: selected.offsetHeight },
      instant
    );
  }

  function setType(type, animate) {
    state.type = type;
    $$('.type-option', els.typeSelector).forEach((label) => {
      const input = $('input', label);
      label.classList.toggle('is-selected', input.value === type);
    });
    positionThumb(!animate);

    $$('[data-for]').forEach((group) => {
      const show = group.dataset.for === type;
      const wasHidden = group.hidden;
      group.hidden = !show;
      if (show && wasHidden && animate) FX.enter(group);
    });

    $('#notesLabel').innerHTML =
      (type === 'Newcomer' ? 'Notes for the follow-up team' : 'Membership or connection notes') + ' <span class="opt">optional</span>';
    $('#notes').placeholder =
      type === 'Newcomer' ? 'Anything the pastoral team should know' : 'e.g. returning after time away, transferred from another branch';
    clearAllErrors();
    syncMethodField(false);
  }

  function syncMethodField(animate) {
    const show = state.type === 'Newcomer' && radioValue('followUpConsent') === 'Yes';
    const wasHidden = els.methodField.hidden;
    els.methodField.hidden = !show;
    if (show && wasHidden && animate) FX.enter(els.methodField);
  }

  /* ---------- validation display ---------- */

  function fieldEl(name) {
    return form.elements[name];
  }

  function setError(name, message) {
    const p = $('[data-error-for="' + name + '"]');
    const input = fieldEl(name);
    if (!p || !input) return;
    p.textContent = message || '';
    p.classList.toggle('is-visible', !!message);
    if (input.setAttribute) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors() {
    $$('[data-error-for]').forEach((p) => setError(p.dataset.errorFor, ''));
    hideAlert();
  }

  function showErrors(errors) {
    $$('[data-error-for]').forEach((p) => setError(p.dataset.errorFor, errors[p.dataset.errorFor] || ''));
    const first = $$('[data-error-for]').find((p) => errors[p.dataset.errorFor]);
    if (first) {
      const input = fieldEl(first.dataset.errorFor);
      if (input) {
        input.focus({ preventScroll: true });
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function showAlert(message) {
    els.alert.textContent = message;
    els.alert.hidden = false;
    FX.enter(els.alert);
  }

  function hideAlert() {
    els.alert.hidden = true;
    els.alert.textContent = '';
  }

  /* ---------- form data ---------- */

  function collect() {
    const f = form.elements;
    const v = {
      contactType: state.type,
      fullName: f.fullName.value,
      phone: f.phone.value,
      email: f.email.value,
      gender: f.gender.value,
      ageGroup: f.ageGroup.value,
      serviceDate: f.serviceDate.value,
      serviceAttended: f.serviceAttended.value,
      branch: f.branch ? f.branch.value : '',
      referralSource: f.referralSource.value,
      notes: f.notes.value.trim(),
      department: '',
      firstVisit: '',
      followUpConsent: '',
      followUpMethod: ''
    };
    if (state.type === 'Newcomer') {
      v.firstVisit = radioValue('firstVisit');
      v.followUpConsent = radioValue('followUpConsent'); // '' means not answered, treated as no consent
      v.followUpMethod = v.followUpConsent === 'Yes' ? f.followUpMethod.value : '';
    } else {
      v.department = f.department.value.trim();
    }
    return v;
  }

  /* ---------- submitting ---------- */

  function setSubmitting(on) {
    state.submitting = on;
    els.submitBtn.disabled = on;
    els.submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
    els.spinner.hidden = !on;
    els.submitLabel.textContent = on ? 'Saving record...' : 'Register Connection';
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (state.submitting || els.submitBtn.disabled) return;

    // Honeypot: silently stop obvious bots without giving them feedback.
    if (form.elements.website.value) return;

    hideAlert();
    const { errors, clean } = V.validate(collect());
    if (Object.keys(errors).length) {
      showErrors(errors);
      return;
    }
    showErrors({});

    setSubmitting(true);
    try {
      const result = await API.submit(Object.assign({}, clean, { registrationId: state.registrationId, website: '' }));
      onSaved(clean, result);
    } catch (err) {
      if (err.fieldErrors) showErrors(err.fieldErrors);
      showAlert(err.userMessage || 'Something went wrong and the record wasn’t saved. Your entries are still here. Please retry.');
    } finally {
      // Don't re-enable the button if the panel has switched to success, or if we're unconfigured.
      if (!els.success.hidden || API.mode() === 'unconfigured') {
        state.submitting = false;
        els.spinner.hidden = true;
        els.submitBtn.removeAttribute('aria-busy');
      } else {
        setSubmitting(false);
      }
    }
  }

  function followUpSummary(clean, status) {
    if (clean.contactType !== 'Newcomer') return 'Recorded as an existing member. No follow-up needed.';
    if (status === 'No Consent') return 'No follow-up will be made because contact wasn’t agreed.';
    const how = clean.followUpMethod ? ' by ' + clean.followUpMethod.toLowerCase() : '';
    return 'Follow-up status: ' + (status || 'Pending') + how + '.';
  }

  function onSaved(clean, result) {
    const demo = !!result.demo;
    const status = result.followUpStatus || '';

    addRecent({
      id: result.registrationId || state.registrationId,
      name: clean.fullName,
      type: clean.contactType,
      time: new Date().toISOString(),
      status,
      demo
    });

    $('#successName').textContent = clean.fullName;
    $('#successTitle').textContent = demo ? 'Demo only. Not saved.' : result.duplicate ? 'Already saved' : 'Connection saved';
    $('#successDetail').textContent =
      (demo
        ? 'This was a demo, so nothing was sent to Google Sheets. '
        : result.duplicate
        ? 'This registration had already reached the sheet, so no second row was added. '
        : 'The record is now in the church’s Google Sheet. ') + followUpSummary(clean, status);
    $('#successPanel').dataset.demo = demo ? 'true' : 'false';

    els.formCard.hidden = true;
    $('#typeBlock').hidden = true;
    els.success.hidden = false;
    els.success.focus({ preventScroll: true });
    els.success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    FX.enter(els.success);
    FX.pop($('#successIcon'));
  }

  function resetForNext() {
    // Keep the service details: ushers usually register many people for the same service.
    const keep = {
      serviceDate: form.elements.serviceDate.value,
      serviceAttended: form.elements.serviceAttended.value,
      branch: form.elements.branch ? form.elements.branch.value : ''
    };
    form.reset();
    form.elements.serviceDate.value = keep.serviceDate || V.todayLocal();
    form.elements.serviceAttended.value = keep.serviceAttended;
    if (form.elements.branch) form.elements.branch.value = keep.branch;
    state.registrationId = newId();
    els.phoneHint.textContent = '';
    clearAllErrors();
    setSubmitting(false);

    els.success.hidden = true;
    els.formCard.hidden = false;
    $('#typeBlock').hidden = false;
    setType(state.type, false);
    positionThumb(true);
    FX.enter(els.formCard);
    form.elements.fullName.focus({ preventScroll: true });
    els.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- recent registrations (this browser session, names only) ---------- */

  function addRecent(item) {
    state.recent = [item].concat(state.recent.filter((r) => r.id !== item.id)).slice(0, 20);
    saveRecent();
    renderRecent(true);
  }

  function initials(name) {
    const parts = name.split(' ').filter(Boolean);
    return ((parts[0] || '')[0] || '').toUpperCase() + ((parts.length > 1 ? parts[parts.length - 1][0] : '') || '').toUpperCase();
  }

  function renderRecent(animateFirst) {
    els.recentList.innerHTML = '';
    els.recentEmpty.hidden = state.recent.length > 0;
    els.clearRecent.hidden = state.recent.length === 0;

    state.recent.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'recent-item';

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = initials(r.name);

      const body = document.createElement('div');
      body.className = 'recent-body';
      const name = document.createElement('p');
      name.className = 'recent-name';
      name.textContent = r.name;
      const meta = document.createElement('p');
      meta.className = 'recent-meta';
      const time = new Date(r.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      meta.textContent = (r.type === 'Newcomer' ? 'Newcomer' : 'Member') + ', ' + time;

      body.appendChild(name);
      body.appendChild(meta);

      const tag = document.createElement('span');
      tag.className = 'tag';
      const label = r.demo ? 'Demo' : r.status || '';
      tag.textContent = label;
      tag.dataset.tag = (r.demo ? 'demo' : r.status || '').toLowerCase().replace(/\s+/g, '-');
      if (!label) tag.hidden = true;

      li.appendChild(avatar);
      li.appendChild(body);
      li.appendChild(tag);
      els.recentList.appendChild(li);
      if (animateFirst && i === 0) FX.enter(li);
    });
  }

  /* ---------- events ---------- */

  function bindEvents() {
    form.addEventListener('submit', onSubmit);
    $('#anotherBtn').addEventListener('click', resetForNext);

    $$('input[name="contactType"]', els.typeSelector).forEach((input) => {
      input.addEventListener('change', () => setType(input.value, true));
    });

    $$('input[name="followUpConsent"]').forEach((r) => r.addEventListener('change', () => syncMethodField(true)));

    // Live phone preview so ushers can see how the number will be saved.
    form.elements.phone.addEventListener('input', () => {
      const p = V.normalizePhone(form.elements.phone.value);
      els.phoneHint.textContent = p.valid ? 'Will be saved as ' + p.display : '';
      setError('phone', '');
    });

    ['fullName', 'email', 'serviceDate', 'notes'].forEach((n) => form.elements[n].addEventListener('input', () => setError(n, '')));

    // Validate a field when the usher leaves it.
    form.elements.phone.addEventListener('blur', () => {
      const v = form.elements.phone.value.trim();
      if (v && !V.normalizePhone(v).valid) setError('phone', 'Use a valid number, like 08012345678 or +2348012345678.');
    });
    form.elements.email.addEventListener('blur', () => {
      const v = form.elements.email.value.trim().toLowerCase();
      if (v && !V.isValidEmail(v)) setError('email', 'Enter a valid email address, like name@example.com.');
    });

    els.clearRecent.addEventListener('click', () => {
      state.recent = [];
      saveRecent();
      renderRecent(false);
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => positionThumb(true), 80);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => positionThumb(true));
  }

  /* ---------- start ---------- */

  setupBranding();
  setupOptions();
  setupMode();
  bindEvents();
  setType('Newcomer', false);
  renderRecent(false);
  positionThumb(true);
  FX.intro([$('#siteHeader'), $('#welcome'), $('#typeBlock'), $('#formCard'), $('#recentCard')]);
})();
