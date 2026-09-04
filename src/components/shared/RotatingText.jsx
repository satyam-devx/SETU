// ═══════════════════════════════════════════════════════════
// SETU — RotatingText
// Crossfades through a list of phrases on an interval. Used for
// the welcome screen's changing headline. Pauses cleanly on
// unmount — no dangling timers.
// ═══════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function RotatingText({ phrases, interval = 2600, className }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!phrases || phrases.length < 2) return;

    let fadeOutTimer;
    const rotateTimer = setInterval(() => {
      setVisible(false);
      fadeOutTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 200); // matches the fade-out duration below
    }, interval);

    return () => {
      clearInterval(rotateTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [phrases, interval]);

  if (!phrases || phrases.length === 0) return null;

  return (
    <span
      className={cn(
        'inline-block transition-all duration-200 ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
        className
      )}
    >
      {phrases[index]}
    </span>
  );
}
