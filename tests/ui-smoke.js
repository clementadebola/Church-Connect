const { JSDOM } = require('jsdom');
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

async function load(url, configPatch, fetchImpl) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*src="https:[^>]*><\/script>/g, '').replace(/<link[^>]*fonts[^>]*>/g, '');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.fetch = fetchImpl || (() => Promise.reject(new Error('no fetch')));
  w.AbortController = AbortController;
  const run = (f) => w.eval(fs.readFileSync(path.join(root, f), 'utf8'));
  run('js/config.js');
  Object.assign(w.CHURCH_CONNECT_CONFIG, configPatch || {});
  ['js/validation.js', 'js/api.js', 'js/motion.js', 'js/app.js'].forEach(run);
  return w;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const type = (w, id, v) => { const el = w.document.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const submit = (w) => w.document.getElementById('regForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

(async () => {
  console.log('\nUnconfigured');
  let w = await load('http://localhost/');
  ok(w.document.getElementById('submitBtn').disabled, 'submit disabled with setup banner');
  ok(!w.document.getElementById('setupBanner').hidden, 'setup banner visible');

  console.log('\nDemo mode');
  w = await load('http://localhost/?demo=1');
  const d = w.document;
  ok(d.querySelector('input[name=contactType]:checked').value === 'Newcomer', 'defaults to Newcomer');
  ok(!d.getElementById('newcomerGroup').hidden && d.getElementById('memberGroup').hidden, 'newcomer fields shown');
  ok(d.getElementById('serviceDate').value.length === 10, 'service date defaults to today');

  submit(w); await wait(20);
  ok(d.getElementById('err-fullName').textContent && d.getElementById('err-phone').textContent, 'empty submit shows name + phone errors');
  ok(d.getElementById('successPanel').hidden, 'no success on invalid');

  type(w, 'fullName', 'Ada Obi'); type(w, 'phone', '0801 234 5678'); type(w, 'email', 'bad');
  ok(d.getElementById('hint-phone').textContent.includes('+234 801 234 5678'), 'phone preview shows normalised number');
  submit(w); await wait(20);
  ok(d.getElementById('err-email').textContent, 'bad email blocked');
  ok(d.getElementById('fullName').value === 'Ada Obi', 'entered data preserved on error');

  type(w, 'email', '');
  d.querySelector('input[name=followUpConsent][value=Yes]').checked = true;
  d.querySelector('input[name=followUpConsent][value=Yes]').dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(!d.getElementById('methodField').hidden, 'method field appears after consent');
  submit(w);
  ok(d.getElementById('submitBtn').disabled && d.getElementById('submitLabel').textContent === 'Saving record...', 'button disabled + "Saving record..." while submitting');
  await wait(900);
  ok(!d.getElementById('successPanel').hidden, 'success panel after demo submit');
  ok(d.getElementById('successTitle').textContent.includes('Demo'), 'demo success is labelled as not saved');
  ok(d.querySelectorAll('.recent-item').length === 1, 'recent list has 1 item');
  ok(!/\+234|801/.test(d.getElementById('recentList').textContent), 'recent list hides phone');

  d.getElementById('anotherBtn').click();
  ok(d.getElementById('successPanel').hidden && !d.getElementById('formCard').hidden, 'register another returns to form');
  ok(d.getElementById('fullName').value === '' && d.getElementById('submitBtn').disabled === false, 'form cleared and button re-enabled');

  console.log('\nType switching');
  const m = d.querySelector('input[name=contactType][value="Existing Member"]');
  m.checked = true; m.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(d.getElementById('newcomerGroup').hidden && !d.getElementById('memberGroup').hidden, 'member fields shown, newcomer hidden');

  console.log('\nLive mode');
  const URL_OK = 'https://script.google.com/macros/s/AKfycbTEST/exec';
  const calls = [];
  const mk = (handler) => (url, opts) => { calls.push({ url, opts }); return handler(url, opts); };
  const jsonRes = (o) => Promise.resolve({ json: () => Promise.resolve(o) });

  w = await load('http://localhost/', { APPS_SCRIPT_URL: URL_OK }, mk((u) => jsonRes({ ok: true, service: 'church-connect' })));
  await wait(30);
  ok(w.document.getElementById('statusPill').dataset.state === 'ok', 'status pill shows connected after ping');

  // Network failure
  w = await load('http://localhost/', { APPS_SCRIPT_URL: URL_OK }, mk((u, o) => (o && o.method === 'POST' ? Promise.reject(new TypeError('Failed to fetch')) : jsonRes({ ok: true }))));
  await wait(30);
  type(w, 'fullName', 'Chidi Eze'); type(w, 'phone', '+2348055550000');
  submit(w); await wait(50);
  ok(!w.document.getElementById('formAlert').hidden && /reach Google Sheets/.test(w.document.getElementById('formAlert').textContent), 'network failure shows friendly error');
  ok(w.document.getElementById('successPanel').hidden, 'no success on network failure');
  ok(w.document.getElementById('fullName').value === 'Chidi Eze', 'data preserved after failure');
  ok(!w.document.getElementById('submitBtn').disabled, 'retry possible');

  // Backend says not ok
  w = await load('http://localhost/', { APPS_SCRIPT_URL: URL_OK }, mk((u, o) => (o && o.method === 'POST' ? jsonRes({ ok: false, code: 'SERVER_ERROR', message: 'The record could not be saved. Please retry.' }) : jsonRes({ ok: true }))));
  await wait(30);
  type(w, 'fullName', 'Chidi Eze'); type(w, 'phone', '08055550000'); submit(w); await wait(50);
  ok(w.document.getElementById('successPanel').hidden && /could not be saved/.test(w.document.getElementById('formAlert').textContent), 'backend failure never shows success');

  // Success + payload check
  calls.length = 0;
  w = await load('http://localhost/', { APPS_SCRIPT_URL: URL_OK }, mk((u, o) => (o && o.method === 'POST' ? jsonRes({ ok: true, registrationId: 'x', followUpStatus: 'No Consent' }) : jsonRes({ ok: true }))));
  await wait(30);
  type(w, 'fullName', 'Chidi Eze'); type(w, 'phone', '2348055550000'); submit(w); await wait(50);
  const post = calls.find((c) => c.opts && c.opts.method === 'POST');
  const body = JSON.parse(post.opts.body);
  ok(!w.document.getElementById('successPanel').hidden && w.document.getElementById('successTitle').textContent === 'Connection saved', 'real success shows "Connection saved"');
  ok(body.phone === '+2348055550000' && body.contactType === 'Newcomer' && body.registrationId, 'payload has normalised phone, type and ID');
  ok(post.opts.headers['Content-Type'].startsWith('text/plain'), 'POST is a simple request (no CORS preflight)');

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
