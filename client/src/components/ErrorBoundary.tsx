import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-100 p-8 text-center">
        <div className="bg-white rounded-2xl shadow-md max-w-sm w-full p-8 flex flex-col items-center gap-4">
          <span className="text-5xl">⚠️</span>
          <h1 className="text-xl font-bold text-gray-800">Something went wrong</h1>
          <p className="text-sm text-gray-500">
            An unexpected error occurred. Your data is safe — try refreshing the page.
          </p>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 w-full text-left font-mono break-all">
            {this.state.error.message}
          </p>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors w-full"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <button
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            Try to recover without reloading
          </button>
        </div>
      </div>
    );
  }
}
