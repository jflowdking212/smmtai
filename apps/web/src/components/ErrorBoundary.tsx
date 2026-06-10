import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

// Detect dynamic import / chunk-load failures (stale deploy)
function isChunkLoadError(error: Error): boolean {
  const msg = error?.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Importing a module script failed') ||
    /\.js.*failed/i.test(msg)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  private chunkReloadAttempted = false;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const chunkError = isChunkLoadError(error);
    return { hasError: true, error, isChunkError: chunkError };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Only log non-chunk errors — chunk load failures are expected after deployments
    if (!isChunkLoadError(error)) {
      try {
        // Attempt Sentry capture if available
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Sentry = require('@sentry/react');
        Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
      } catch {
        // Sentry not configured — that's fine
      }
      console.error('ErrorBoundary caught:', error, errorInfo);
    }

    // Auto-reload once if it's a chunk load error (stale HTML after deploy)
    if (isChunkLoadError(error) && !this.chunkReloadAttempted) {
      this.chunkReloadAttempted = true;
      // Short delay so the user doesn't get a jarring instant reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Chunk / network error — show minimal "refreshing" UI
      if (this.state.isChunkError) {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-8">
            <Card className="p-8 max-w-md text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <WifiOff className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-heading font-semibold text-neutral-800 mb-2">
                App update detected
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                A new version of SmmtAI is available. The page will refresh automatically to load the latest version.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Refreshing…
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-xs text-violet-600 underline hover:no-underline"
              >
                Click here if it doesn't refresh automatically
              </button>
            </Card>
          </div>
        );
      }

      // Generic error — show user-friendly message WITHOUT exposing raw error details
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <Card className="p-8 max-w-md text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-neutral-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500 mb-6">
              An unexpected error occurred. Our team has been notified. Please try again or reload the page.
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={this.handleReset}>
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </Button>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
