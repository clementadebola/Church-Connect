/**
 * Run with:  node tests/run-tests.js
 * No dependencies. Tests the browser validation and the Apps Script backend (with mocked Google services).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}

/* ---------------- Frontend validation ---------------- */
console.log('\nFrontend validation');
const V = require('../js/validation.js');

[
  ['08012345678', '+2348012345678'],
  ['0801 234 5678', '+2348012345678'],
  ['+2348012345678', '+2348012345678'],
  ['2348012345678', '+2348012345678'],
  ['+234 (0) 801 234 5678', '+2348012345678'],
  ['8012345678', '+2348012345678'],
  ['09012345678', '+2349012345678'],
  ['07012345678', '+2347012345678'],
  ['+447911123456', '+447911123456']
].forEach(([input, expected]) =>
  test('phone ' + input + ' → ' + expected, () => assert.strictEqual(V.normalizePhone(input).value, expected))
);

['', '0801234567', '080123456789', '01234567890', 'abc', '+2341', '12345'].forEach((bad) =>
  test('phone rejects "' + bad + '"', () => assert.strictEqual(V.normalizePhone(bad).valid, false))
);

const base = { contactType: 'Newcomer', fullName: 'Ada Obi', phone: '08012345678', email: '', serviceDate: '2026-10-04', followUpConsent: 'Yes', followUpMethod: 'SMS' };
const TODAY = '2026-10-10';

test('valid newcomer passes', () => assert.deepStrictEqual(V.validate(base, TODAY).errors, {}));
test('missing name', () => assert.ok(V.validate({ ...base, fullName: '  ' }, TODAY).errors.fullName));
test('numbers-only name rejected', () => assert.ok(V.validate({ ...base, fullName: '1234' }, TODAY).errors.fullName));
test('missing phone', () => assert.ok(V.validate({ ...base, phone: '' }, TODAY).errors.phone));
test('invalid email', () => assert.ok(V.validate({ ...base, email: 'not-an-email' }, TODAY).errors.email));
test('valid email passes', () => assert.strictEqual(V.validate({ ...base, email: 'A@B.com' }, TODAY).clean.email, 'a@b.com'));
test('missing date', () => assert.ok(V.validate({ ...base, serviceDate: '' }, TODAY).errors.serviceDate));
test('future date rejected', () => assert.ok(V.validate({ ...base, serviceDate: '2026-12-25' }, TODAY).errors.serviceDate));
test('impossible date rejected', () => assert.ok(V.validate({ ...base, serviceDate: '2026-02-31' }, TODAY).errors.serviceDate));
test('missing contact type', () => assert.ok(V.validate({ ...base, contactType: '' }, TODAY).errors.contactType));
test('email follow-up needs email', () => assert.ok(V.validate({ ...base, followUpMethod: 'Email' }, TODAY).errors.email));
test('no consent clears follow-up method', () => assert.strictEqual(V.validate({ ...base, followUpConsent: 'No' }, TODAY).clean.followUpMethod, ''));
test('phone is normalised in clean output', () => assert.strictEqual(V.validate({ ...base, phone: '0801 234 5678' }, TODAY).clean.phone, '+2348012345678'));

/* ---------------- Apps Script backend ---------------- */
console.log('\nApps Script backend (mocked Google services)');

function makeBackend() {
  const rows = [];
  const cache = {};
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: (r, c, nr, nc) => ({
      setNumberFormat() { return this; },
      setValues(v) { v.forEach((row, i) => (rows[r - 2 + i] = row)); return this; },
      createTextFinder(id) {
        return { matchEntireCell() { return this; }, findNext: () => (rows.some((x) => x[0] === id) ? {} : null) };
      }
    })
  };
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ getContent: () => t, setMimeType() { return this; } })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => (cache[k] = v) }) },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      getActiveSpreadsheet: () => null,
      flush() {}
    },
    Session: { getScriptTimeZone: () => 'Africa/Lagos' },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, '0');
        const ymd = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
        return fmt === 'yyyy-MM-dd' ? ymd : ymd + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
      },
      computeDigest: (alg, text) => Array.from(require('crypto').createHash('md5').update(text).digest()),
      DigestAlgorithm: { MD5: 'MD5' },
      Charset: { UTF_8: 'UTF_8' }
    }
  };
  vm.createContext(sandbox);
  let code = fs.readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  code = code.replace("SPREADSHEET_ID: ''", "SPREADSHEET_ID: 'mock'");
  // const declarations are not visible on the context object, so expose what we need.
  vm.runInContext(code + '\n;this.doPost = doPost; this.doGet = doGet; this.CONFIG = CONFIG;', sandbox);
  const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent());
  return { post, rows, sandbox, cache };
}

const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
const good = () => ({ registrationId: 'reg-' + Math.random().toString(36).slice(2, 12), contactType: 'Newcomer', fullName: 'Ada Obi', phone: '0801 234 5678', serviceDate: today, followUpConsent: 'Yes', followUpMethod: 'SMS', website: '' });

test('health check returns ok', () => {
  const b = makeBackend();
  assert.strictEqual(JSON.parse(b.sandbox.doGet().getContent()).ok, true);
});

test('valid newcomer is written as one row with Pending status and normalised phone', () => {
  const b = makeBackend();
  const res = b.post(good());
  assert.strictEqual(res.ok, true);
  assert.strictEqual(b.rows.length, 1);
  assert.strictEqual(b.rows[0].length, 20);
  assert.strictEqual(b.rows[0][3], '+2348012345678');
  assert.strictEqual(b.rows[0][17], 'Pending');
  assert.strictEqual(b.rows[0][14], 'Yes');
});

test('newcomer without consent → No Consent, no method', () => {
  const b = makeBackend();
  const res = b.post({ ...good(), followUpConsent: '' });
  assert.strictEqual(res.followUpStatus, 'No Consent');
  assert.strictEqual(b.rows[0][14], 'Not answered');
  assert.strictEqual(b.rows[0][13], '');
});

test('existing member is not treated as a newcomer', () => {
  const b = makeBackend();
  const res = b.post({ ...good(), contactType: 'Existing Member', department: 'Choir', followUpConsent: 'Yes' });
  assert.strictEqual(res.followUpStatus, 'Not Required');
  assert.strictEqual(b.rows[0][15], 'Choir');
  assert.strictEqual(b.rows[0][6], '');
});

test('same registration ID twice → one row, second reply flagged duplicate', () => {
  const b = makeBackend();
  const rec = good();
  b.post(rec);
  const again = b.post(rec);
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.duplicate, true);
  assert.strictEqual(b.rows.length, 1);
});

test('double-tap with new ID but same person/date → still one row', () => {
  const b = makeBackend();
  b.post(good());
  const again = b.post(good());
  assert.strictEqual(again.duplicate, true);
  assert.strictEqual(b.rows.length, 1);
});

test('missing required fields rejected with field errors', () => {
  const b = makeBackend();
  const res = b.post({ registrationId: 'abcdefgh1', contactType: 'Newcomer', website: '' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'VALIDATION');
  assert.ok(res.errors.fullName && res.errors.phone && res.errors.serviceDate);
  assert.strictEqual(b.rows.length, 0);
});

test('bad email and bad phone rejected', () => {
  const b = makeBackend();
  const res = b.post({ ...good(), email: 'nope', phone: '123' });
  assert.ok(res.errors.email && res.errors.phone);
});

test('malformed JSON rejected', () => assert.strictEqual(makeBackend().post('{not json').code, 'BAD_JSON'));
test('JSON array rejected', () => assert.strictEqual(makeBackend().post('[1,2]').code, 'BAD_JSON'));
test('honeypot rejected', () => assert.strictEqual(makeBackend().post({ ...good(), website: 'spam' }).ok, false));

test('formula-looking text is stored as-is (sheet columns are plain text)', () => {
  const b = makeBackend();
  b.post({ ...good(), notes: '=HYPERLINK("http://x")' });
  assert.strictEqual(b.rows[0][16], '=HYPERLINK("http://x")');
});

test('rate limit stops runaway submissions', () => {
  const b = makeBackend();
  b.cache['rate_count'] = '150';
  assert.strictEqual(b.post(good()).code, 'RATE_LIMITED');
  assert.strictEqual(b.rows.length, 0);
});

test('write failure never reports success', () => {
  const b = makeBackend();
  b.sandbox.SpreadsheetApp.openById = () => { throw new Error('boom'); };
  const res = b.post(good());
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'SERVER_ERROR');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
