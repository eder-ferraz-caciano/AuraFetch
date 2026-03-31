import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'var(--text-primary)', textAlign: 'center' }}>
          <h2>Algo deu errado (Erro Renderização).</h2>
          <p style={{ color: 'var(--danger)' }}>{this.state.error?.message}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar App</button>
        </div>
      );
    }
    return this.props.children;
  }
}
