/**
 * Validation helpers. Works in the browser (window.CCValidation) and in Node (module.exports) for tests.
 * The Apps Script backend repeats these rules, so never rely on the browser alone.
 */
(function (root) {
  'use strict';

  /** Returns { valid, value, display }. value is what we save, e.g. +2348012345678 */
  function normalizePhone(raw) {
    const empty = { valid: false, value: '', display: '' };
    if (raw == null) return empty;
    let s = String(raw).trim().replace(/[\s\-().]/g, '');
    if (!s) return empty;
    if (s.startsWith('00')) s = '+' + s.slice(2);

    const hasPlus = s.startsWith('+');
    const digits = hasPlus ? s.slice(1) : s;
    if (!/^\d+$/.test(digits)) return empty;

    // Other countries: accept a well-formed international number (visitors travel).
    if (hasPlus && !digits.startsWith('234')) {
      if (/^[1-9]\d{7,14}$/.test(digits)) return { valid: true, value: '+' + digits, display: '+' + digits };
      return empty;
    }

    let national;
    if (digits.startsWith('234')) {
      national = digits.slice(3);
      if (national.startsWith('0')) national = national.slice(1); // +234 0801… typo
    } else if (digits.startsWith('0')) {
      national = digits.slice(1);
    } else if (!hasPlus && digits.length === 10) {
      national = digits; // 8012345678
    } else {
      return empty;
    }

    if (!/^[789]\d{9}$/.test(national)) return empty;
    const value = '+234' + national;
    return {
      valid: true,
      value,
      display: '+234 ' + national.slice(0, 3) + ' ' + national.slice(3, 6) + ' ' + national.slice(6)
    };
  }

  function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function todayLocal() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isRealDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /**
   * values: raw form values. Returns { errors: {field: message}, clean: {...normalised values} }
   */
  function validate(values, today) {
    const errors = {};
    const clean = Object.assign({}, values);
    const todayStr = today || todayLocal();

    clean.fullName = (values.fullName || '').replace(/\s+/g, ' ').trim();
    if (!clean.fullName) errors.fullName = 'Enter the person’s full name.';
    else if (clean.fullName.length < 2 || !/\p{L}/u.test(clean.fullName)) errors.fullName = 'Enter a real name (letters, at least 2 characters).';
    else if (clean.fullName.length > 100) errors.fullName = 'Name is too long (100 characters maximum).';

    const phone = normalizePhone(values.phone);
    if (!String(values.phone || '').trim()) errors.phone = 'Enter a phone number.';
    else if (!phone.valid) errors.phone = 'Use a valid number, like 08012345678 or +2348012345678.';
    else clean.phone = phone.value;

    clean.email = (values.email || '').trim().toLowerCase();
    if (clean.email && !isValidEmail(clean.email)) errors.email = 'Enter a valid email address, like name@example.com.';

    if (values.contactType !== 'Newcomer' && values.contactType !== 'Existing Member') {
      errors.contactType = 'Choose Newcomer or Existing Member.';
    }

    if (!values.serviceDate) errors.serviceDate = 'Choose the service date.';
    else if (!isRealDate(values.serviceDate)) errors.serviceDate = 'Enter a valid date.';
    else if (values.serviceDate > todayStr) errors.serviceDate = 'The service date can’t be in the future.';

    if (values.contactType === 'Newcomer') {
      if (values.followUpConsent === 'Yes' && values.followUpMethod === 'Email' && !clean.email && !errors.email) {
        errors.email = 'Add an email address, or choose a different follow-up method.';
      }
      if (values.followUpConsent !== 'Yes') clean.followUpMethod = '';
    } else {
      clean.followUpMethod = '';
      clean.firstVisit = '';
      clean.followUpConsent = '';
    }

    if ((values.notes || '').length > 1000) errors.notes = 'Notes are too long (1000 characters maximum).';

    return { errors, clean };
  }

  const api = { normalizePhone, isValidEmail, isRealDate, todayLocal, validate };
  root.CCValidation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
