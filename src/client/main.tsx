import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ProfileApp';  // <- after renaming the file

console.log('[main] main.tsx loaded');

class RootBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[boundary] Caught error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', fontFamily: 'monospace', color: 'red' }}>
          <h2>App crashed</h2>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>
);