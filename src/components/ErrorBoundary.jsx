import React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Catches uncaught JS errors in any child component tree and
 * renders a graceful fallback UI instead of a white screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="flex flex-col gap-3">
              <button type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button type="button"
                onClick={() => (window.location.href = "/")}
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
