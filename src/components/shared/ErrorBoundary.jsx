// ═══════════════════════════════════════════════════════════
// SETU — ErrorBoundary
// Catches uncaught React render errors per portal.
// Prevents the entire app from going blank on a single crash.
// Constitution ref: "Security from Day 1 / reliability from first commit"
// ═══════════════════════════════════════════════════════════
import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { captureError } from '@/lib/observability';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Central observability sink (console + Sentry hook + Supabase log).
    captureError(error, {
      portal: this.props.portal ?? 'App',
      componentStack: errorInfo?.componentStack?.slice(0, 2000),
      kind: 'react.errorBoundary',
    }, 'fatal');
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { portal = 'App', fallbackRoute = '/' } = this.props;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-5">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div className="text-center max-w-xs">
          <h2 className="font-semibold text-foreground mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            The {portal} portal encountered an error. Your data is safe.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-3 text-left text-[10px] bg-muted p-3 rounded-lg overflow-auto max-h-32 text-destructive">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 text-sm text-primary font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <a href={fallbackRoute} className="text-sm text-muted-foreground underline">
            Go Home
          </a>
        </div>
      </div>
    );
  }
}
