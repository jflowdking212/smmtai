import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { Button, Card } from '@/components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <Card className="p-8 max-w-md text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-neutral-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              An unexpected error occurred. The issue has been reported automatically.
            </p>
            {this.state.error && (
              <p className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-3 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
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
