import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result } from "antd";
import { useTranslation } from "react-i18next";

type ErrorFallbackProps = {
  onRetry: () => void;
};

function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation("errors");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Result
        status="error"
        title={t("boundary.title")}
        subTitle={t("boundary.description")}
        extra={
          <Button type="primary" onClick={onRetry}>
            {t("boundary.retry")}
          </Button>
        }
      />
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Last line of defence for render errors. The fallback stays inside the theme
 * and i18n providers so it is styled and translated like the rest of the app.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The browser console is the only sink available in the SPA bundle.
    // Server-side logging is out of scope for render errors.
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.reset} />;
    }

    return this.props.children;
  }
}
