// SETU — shared client-side validation
// Client validation is UX only. Server/RPC validation remains authoritative.

export const validators = Object.freeze({
  required(value, label = 'This field') {
    return String(value ?? '').trim() ? null : `${label} is required.`;
  },

  indianPhone(value) {
    return /^[6-9]\d{9}$/.test(String(value ?? '').replace(/\D/g, ''))
      ? null
      : 'Please enter a valid 10-digit Indian mobile number.';
  },

  email(value) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
      ? null
      : 'Please enter a valid email address.';
  },

  positiveAmount(value, label = 'Amount') {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? null : `${label} must be greater than 0.`;
  },
});

export function firstValidationError(checks) {
  for (const check of checks) {
    const message = typeof check === 'function' ? check() : check;
    if (message) return message;
  }
  return null;
}
