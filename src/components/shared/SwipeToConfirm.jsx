// ═══════════════════════════════════════════════════════════
// SETU — SwipeToConfirm
//
// A drag-to-confirm slider (the "Slide to order" pattern from
// Uber/food-delivery apps) instead of a plain tap button, for
// actions where an accidental tap is expensive to undo (placing a
// real order, paying real money).
//
// Built with plain pointer events + CSS transitions/keyframes — no
// animation library. This codebase deliberately dropped framer-motion
// (see index.css's note on RoleSelect.jsx: "118KB in the production
// bundle for four simple fade/slide-in entrances with staggered
// delays, which plain CSS does identically") — a drag slider is more
// involved than a fade-in, but pointer events + transforms cover it
// completely without pulling in a new dependency for the one screen
// that needs it.
//
// Controlled, not self-managing: `onConfirm` is fired once the drag
// crosses the threshold and is expected to be fire-and-forget from
// this component's point of view — the caller's own async handler
// (CustomerCheckout's handlePlaceOrder) already catches its own
// errors internally and never rejects, so this component can't tell
// success from failure by awaiting a promise. Instead it reflects
// whatever loading/success state the caller already tracks:
//   loading=true            → thumb shows a spinner, mid-track
//   loading=false+success   → thumb completes to a green checkmark
//   loading=false+!success  → thumb springs back to the start (a
//                             failed attempt, e.g. the caller's own
//                             error state got set) so the customer
//                             can try again
//
// Usage:
//   <SwipeToConfirm
//     label="Slide to Place Order"
//     confirmingLabel="Placing your order…"
//     confirmedLabel="Order Placed!"
//     amountLabel="₹450"
//     onConfirm={handlePlaceOrder}
//     loading={placing}
//     success={placed}
//     disabled={someCondition}
//   />
// ═══════════════════════════════════════════════════════════
import React, { useRef, useState, useEffect } from 'react';
import { ChevronsRight, Check, Loader2 } from 'lucide-react';

const THRESHOLD = 0.82; // fraction of travel distance that counts as "confirmed"
const THUMB_SIZE = 52;  // px

export default function SwipeToConfirm({
  label,
  confirmingLabel,
  confirmedLabel = 'Done!',
  amountLabel,
  onConfirm,
  loading = false,
  success = false,
  disabled = false,
  className = '',
}) {
  const trackRef     = useRef(null);
  const draggingRef  = useRef(false);
  const startXRef    = useRef(0);
  const baseXRef     = useRef(0);
  const triggeredRef = useRef(false); // guards against firing onConfirm twice for one drag

  const [dragX,    setDragX]    = useState(0);
  const [maxDrag,  setMaxDrag]  = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        setMaxDrag(Math.max(0, trackRef.current.offsetWidth - THUMB_SIZE - 8)); // 8 = track padding
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Reflect the caller's own state rather than tracking success/failure
  // internally — see file header. A finished, failed attempt (loading
  // just turned false without success) springs the thumb back; a
  // successful one snaps fully to the end and stays there.
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      if (success) setDragX(maxDrag);
      else { setDragX(0); triggeredRef.current = false; }
    }
    prevLoadingRef.current = loading;
  }, [loading, success, maxDrag]);

  const handlePointerDown = (e) => {
    if (disabled || loading || success) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    baseXRef.current = dragX;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.min(maxDrag, Math.max(0, baseXRef.current + delta));
    setDragX(next);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    const reached = maxDrag > 0 && dragX / maxDrag >= THRESHOLD;
    if (!reached) { setDragX(0); return; }

    setDragX(maxDrag);
    if (!triggeredRef.current) {
      triggeredRef.current = true;
      onConfirm?.();
    }
  };

  // Keyboard alternative to dragging — Enter/Space completes the
  // action directly (the accessible equivalent of a full swipe;
  // there's no meaningful "partial drag" via keyboard), matching this
  // control's role="slider" needing a real keyboard path per WCAG 2.1
  // AA, which this codebase's own a11y suite already checks for.
  const handleKeyDown = (e) => {
    if (disabled || loading || success) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDragX(maxDrag);
      if (!triggeredRef.current) {
        triggeredRef.current = true;
        onConfirm?.();
      }
    }
  };

  const progress = maxDrag > 0 ? dragX / maxDrag : 0;
  const isBusy = loading;
  const isDone = success;

  return (
    <div
      ref={trackRef}
      className={`relative h-16 rounded-full overflow-hidden select-none touch-none
        border transition-colors duration-300
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${isDone ? 'bg-green-600 border-green-600' : 'bg-muted border-border'}
        ${disabled && !isDone ? 'opacity-50' : ''}
        ${className}`}
      role="slider"
      tabIndex={disabled || loading || success ? -1 : 0}
      onKeyDown={handleKeyDown}
      aria-label={label}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-disabled={disabled}
    >
      {/* Fill — grows with drag progress */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${isDone ? 'bg-green-500' : 'bg-primary'} ${!dragging ? 'transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
        style={{ width: `${dragX + THUMB_SIZE / 2}px` }}
      />

      {/* Idle shimmer sweep across the whole track — purely decorative,
          switched off under prefers-reduced-motion (see index.css). */}
      {!isBusy && !isDone && !dragging && dragX === 0 && (
        <div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-swipe-sheen" />
        </div>
      )}

      {/* Label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-150"
        style={{ opacity: isDone ? 1 : Math.max(0, 1 - progress * 1.6) }}
      >
        <span className={`text-sm font-bold ${isDone ? 'text-white' : 'text-foreground'}`}>
          {isBusy ? confirmingLabel : isDone ? confirmedLabel : label}
        </span>
        {amountLabel && !isBusy && !isDone && (
          <span className="text-[11px] text-muted-foreground -mt-0.5">{amountLabel}</span>
        )}
      </div>

      {/* Thumb */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute top-1 left-1 rounded-full flex items-center justify-center
          shadow-lg cursor-grab active:cursor-grabbing
          ${isDone ? 'bg-white' : 'bg-primary'}
          ${!dragging ? 'transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]' : ''}
          ${!isBusy && !isDone && !dragging && dragX === 0 ? 'animate-swipe-nudge' : ''}`}
        style={{ transform: `translateX(${dragX}px)`, width: THUMB_SIZE, height: THUMB_SIZE }}
      >
        {isBusy
          ? <Loader2 className="w-5 h-5 text-white animate-spin" aria-hidden="true" />
          : isDone
          ? <Check className="w-6 h-6 text-green-600" aria-hidden="true" />
          : <ChevronsRight className="w-5 h-5 text-primary-foreground" aria-hidden="true" />}
      </div>
    </div>
  );
}
