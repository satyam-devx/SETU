import React from 'react';

export default function AccessibilityAnnouncer({ message, assertive = false }) {
  return (
    <div
      className="sr-only"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message || ''}
    </div>
  );
}
