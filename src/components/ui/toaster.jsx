import React from 'react';
import { X } from 'lucide-react';
import { useToast } from './use-toast';

// Renders the live toast queue from use-toast. Mounted once in App.jsx.
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      id="toaster"
      className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-xs flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === 'destructive' ? 'alert' : 'status'}
          className={[
            'pointer-events-auto rounded-xl border p-3 text-sm shadow-lg',
            'animate-in slide-in-from-bottom-2 fade-in',
            t.variant === 'destructive'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-card text-foreground',
          ].join(' ')}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {t.title && <p className="font-semibold leading-snug">{t.title}</p>}
              {t.description && (
                <p className={`mt-0.5 text-xs ${t.variant === 'destructive' ? 'text-destructive/80' : 'text-muted-foreground'}`}>
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
