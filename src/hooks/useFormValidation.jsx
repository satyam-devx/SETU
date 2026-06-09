// ═══════════════════════════════════════════════════════════
// SETU — useFormValidation
// Lightweight validation hook (no external deps needed yet).
// Designed to be drop-in compatible with react-hook-form
// API when we add it in V1. Just add the resolver.
//
// Constitution: "Avoid frontend hacks / temporary solutions"
// ═══════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';

/**
 * Schema: { fieldName: [{ rule, message }] }
 * Rules: required, minLength, maxLength, pattern, custom(fn)
 *
 * @example
 * const { values, errors, handleChange, handleBlur, validate, reset } = useFormValidation(
 *   { phone: '', name: '' },
 *   { phone: [{ rule: 'required', message: 'Phone required' },
 *             { rule: 'pattern', value: /^\+?[0-9]{10,13}$/, message: 'Invalid phone' }] }
 * )
 */
export function useFormValidation(initialValues = {}, schema = {}) {
  const [values,  setValues]  = useState(initialValues);
  const [errors,  setErrors]  = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback((name, value) => {
    const rules = schema[name];
    if (!rules) return null;

    for (const rule of rules) {
      if (rule.rule === 'required' && (!value || String(value).trim() === '')) {
        return rule.message || `${name} is required`;
      }
      if (rule.rule === 'minLength' && String(value).length < rule.value) {
        return rule.message || `Minimum ${rule.value} characters`;
      }
      if (rule.rule === 'maxLength' && String(value).length > rule.value) {
        return rule.message || `Maximum ${rule.value} characters`;
      }
      if (rule.rule === 'pattern' && value && !rule.value.test(String(value))) {
        return rule.message || 'Invalid format';
      }
      if (rule.rule === 'custom') {
        const msg = rule.validate(value, values);
        if (msg) return msg;
      }
    }
    return null;
  }, [schema, values]);

  const handleChange = useCallback((nameOrEvent, val) => {
    let name, value;
    if (typeof nameOrEvent === 'string') {
      name = nameOrEvent; value = val;
    } else {
      name  = nameOrEvent.target.name  || nameOrEvent.target.id;
      value = nameOrEvent.target.type === 'checkbox'
        ? nameOrEvent.target.checked
        : nameOrEvent.target.value;
    }

    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const err = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: err }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((nameOrEvent) => {
    const name = typeof nameOrEvent === 'string'
      ? nameOrEvent
      : nameOrEvent.target.name || nameOrEvent.target.id;
    setTouched(prev => ({ ...prev, [name]: true }));
    const err = validateField(name, values[name]);
    setErrors(prev => ({ ...prev, [name]: err }));
  }, [values, validateField]);

  const validate = useCallback(() => {
    const newErrors = {};
    let hasError = false;
    for (const name of Object.keys(schema)) {
      const err = validateField(name, values[name]);
      if (err) { newErrors[name] = err; hasError = true; }
    }
    setErrors(newErrors);
    setTouched(Object.fromEntries(Object.keys(schema).map(k => [k, true])));
    return !hasError;
  }, [schema, values, validateField]);

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values, errors, touched, isSubmitting,
    handleChange, handleBlur, validate,
    setIsSubmitting, setValue, reset,
    isValid: Object.values(errors).every(e => !e),
  };
}

// ── Common SETU validators ────────────────────────────────
export const validators = {
  phone: [
    { rule: 'required', message: 'Mobile number is required' },
    { rule: 'pattern',  value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number' },
  ],
  name: [
    { rule: 'required',  message: 'Name is required' },
    { rule: 'minLength', value: 2, message: 'Name must be at least 2 characters' },
    { rule: 'maxLength', value: 60, message: 'Name too long' },
  ],
  otp: [
    { rule: 'required',  message: 'OTP is required' },
    { rule: 'minLength', value: 4, message: 'Enter the 4-digit OTP' },
    { rule: 'maxLength', value: 6, message: 'OTP too long' },
    { rule: 'pattern',   value: /^\d+$/, message: 'OTP must be numeric' },
  ],
  amount: [
    { rule: 'required', message: 'Amount is required' },
    { rule: 'custom',   validate: (v) => v > 0 ? null : 'Amount must be greater than 0' },
  ],
};
