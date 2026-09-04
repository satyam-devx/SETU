// ═══════════════════════════════════════════════════════════
// SETU — AppBackground
//
// The soft, layered blob-gradient background used behind the
// splash screen and the welcome/login screen (and any future
// page that opts in). Mounted once at the app root so it's
// always there, fixed behind everything — pages just need to
// leave their own wrapper transparent instead of painting an
// opaque `bg-background` over it.
//
// Pure decoration: aria-hidden, pointer-events-none, and built
// from CSS custom-property colours so it automatically follows
// the SETU saffron/teal/green palette in both light and dark
// mode without any extra work.
// ═══════════════════════════════════════════════════════════
import React from 'react';

export default function AppBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-28 top-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-1/4 -right-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
    </div>
  );
}
