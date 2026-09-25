import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(active, { initialFocusRef, onEscape } = {}) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  const initialFocusRefRef = useRef(initialFocusRef);

  onEscapeRef.current = onEscape;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!active || !containerRef.current) return undefined;
    const container = containerRef.current;
    previousFocusRef.current = document.activeElement;

    const focusInitial = () => {
      const target = initialFocusRefRef.current?.current || container.querySelector(FOCUSABLE);
      target?.focus?.();
    };
    const raf = requestAnimationFrame(focusInitial);

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = [...container.querySelectorAll(FOCUSABLE)]
        .filter(el => el.getClientRects().length > 0);
      if (!focusables.length) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('keydown', onKeyDown);
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        requestAnimationFrame(() => previous.focus());
      }
    };
  }, [active]);

  return containerRef;
}
