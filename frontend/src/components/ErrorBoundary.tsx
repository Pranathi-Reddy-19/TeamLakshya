// frontend/src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '2rem',
          background: 'var(--background)',
          color: 'var(--text-primary)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>⚠️</div>
          <h1 style={{
            fontSize: '2rem',
            marginBottom: '1rem',
            color: 'var(--error)'
          }}>
            Something went wrong
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            maxWidth: '600px'
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.75rem 2rem',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Return to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;