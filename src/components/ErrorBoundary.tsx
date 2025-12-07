import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary компонент для обработки ошибок React
 * Перехватывает ошибки в дочерних компонентах и показывает fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Логируем ошибку через централизованный logger
    logError('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });
    
    // Сохраняем информацию об ошибке
    this.setState({
      error,
      errorInfo,
    });

    // Вызываем callback если передан
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Здесь можно отправить ошибку в сервис мониторинга (Sentry, etc.)
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Если передан кастомный fallback, используем его
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Стандартный fallback UI
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Что-то пошло не так</CardTitle>
              </div>
              <CardDescription>
                Произошла ошибка при отображении компонента
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Ошибка:
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                    {this.state.error.toString()}
                  </pre>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    Stack trace:
                  </p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Попробовать снова
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Перезагрузить страницу
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
