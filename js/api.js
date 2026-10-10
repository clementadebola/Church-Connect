/**
 * Talks to the Google Apps Script web app.
 * A registration is only reported as saved when the script answers { ok: true }.
 */
(function (root) {
  'use strict';

  const cfg = root.CHURCH_CONNECT_CONFIG || {};
  const url = (cfg.APPS_SCRIPT_URL || '').trim();
  const looksValid = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url);

  function demoRequested() {
    try {
      return cfg.DEMO_MODE === true || new URLSearchParams(root.location.search).get('demo') === '1';
    } catch (e) {
      return cfg.DEMO_MODE === true;
    }
  }

  /** 'live' | 'demo' | 'unconfigured' */
  function mode() {
    if (looksValid && !demoRequested()) return 'live';
    if (demoRequested()) return 'demo';
    return 'unconfigured';
  }

  function makeError(message, code, fieldErrors) {
    const err = new Error(message);
    err.userMessage = message;
    err.code = code;
    err.fieldErrors = fieldErrors || null;
    return err;
  }

  function withTimeout(ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return { signal: controller.signal, done: () => clearTimeout(timer) };
  }

  /** Quick, safe health check. The script returns no personal data. */
  async function ping() {
    if (mode() !== 'live') return { ok: false, mode: mode() };
    const t = withTimeout(8000);
    try {
      const res = await fetch(url + '?action=ping', { method: 'GET', signal: t.signal, cache: 'no-store' });
      const json = await res.json();
      return { ok: json && json.ok === true, mode: 'live' };
    } catch (e) {
      return { ok: false, mode: 'live' };
    } finally {
      t.done();
    }
  }

  async function submit(record) {
    const m = mode();

    if (m === 'demo') {
      await new Promise((r) => setTimeout(r, 700));
      const status =
        record.contactType === 'Newcomer' ? (record.followUpConsent === 'Yes' ? 'Pending' : 'No Consent') : 'Not Required';
      return { ok: true, demo: true, registrationId: record.registrationId, followUpStatus: status };
    }
    if (m === 'unconfigured') {
      throw makeError('Google Sheets isn’t connected yet. Add the Apps Script URL in js/config.js.', 'NOT_CONFIGURED');
    }

    const t = withTimeout(cfg.REQUEST_TIMEOUT_MS || 20000);
    let res;
    try {
      // text/plain keeps this a "simple" request, so the browser doesn't need a CORS preflight.
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record),
        signal: t.signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw makeError(
          'Google took too long to answer. Your entries are still here. Tap Register Connection to retry. It won’t create a duplicate if the first try went through.',
          'TIMEOUT'
        );
      }
      throw makeError('Couldn’t reach Google Sheets. Check the internet connection, then retry. Your entries are still here.', 'NETWORK');
    } finally {
      t.done();
    }

    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw makeError(
        'Google sent back something unexpected. Check that the Apps Script is deployed with access set to “Anyone”, then retry.',
        'BAD_RESPONSE'
      );
    }

    if (!json || json.ok !== true) {
      throw makeError(
        (json && json.message) || 'The record wasn’t saved. Please retry.',
        (json && json.code) || 'REJECTED',
        json && json.errors
      );
    }
    return json;
  }

  root.CCApi = { mode, ping, submit };
})(window);
