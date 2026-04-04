import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    // In production, you would log this to an error reporting service
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
              <AlertTriangle size={28} className="text-red-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-[#e4e4e7] mb-2">
              Oops, terjadi kesalahan
            </h1>
            <p className="text-[#a1a1aa] text-sm mb-8">
              Sesuatu yang tidak terduga terjadi. Silakan coba muat ulang halaman atau kembali ke beranda.
            </p>

            {/* Error details (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 rounded-xl bg-[#18181b] border border-[#27272a] text-left">
                <p className="text-xs font-mono text-red-400 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#e4e4e7] hover:border-[#3f3f46] transition-all"
              >
                <Home size={16} />
                Beranda
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
              >
                <RefreshCw size={16} />
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
