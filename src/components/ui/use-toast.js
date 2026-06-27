// ═══════════════════════════════════════════════════════════
// SETU — Toast store (real implementation)
//
// Previously this file only console.log'd, so every toast({...}) call
// across the app produced no visible UI. This is a lightweight, render-
// agnostic store: toast()/dismiss() mutate a module-level queue and
// notify subscribers; <Toaster /> subscribes via useToast() and renders.
//
// Backward compatible: existing `toast({ title, description })` calls
// now actually surface to the user. `variant: 'destructive'` styles
// errors; `duration` controls auto-dismiss (0 = sticky).
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';

let toasts = [];
let listeners = [];
let idCounter = 0;

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

export function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast({ title, description, variant = 'default', duration = 4000 } = {}) {
  const id = ++idCounter;
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return { id, dismiss: () => dismiss(id) };
}

export function useToast() {
  const [list, setList] = useState(toasts);
  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);
  return { toast, dismiss, toasts: list };
}
