'use client';

import { Component, type ReactNode } from 'react';
import { getSafeErrorMessage } from '@/lib/utils';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
          <div className="bg-surface rounded-xl border border-hairline max-w-md w-full p-8 text-center space-y-4 shadow-floating">
            <div className="w-16 h-16 mx-auto rounded-full bg-danger-soft flex items-center justify-center">
              <span className="text-3xl text-danger">!</span>
            </div>
            <h2 className="font-sans font-bold text-xl text-ink">Terjadi Kesalahan</h2>
            <p className="text-sm text-charcoal font-sans">
              {this.state.error ? getSafeErrorMessage(this.state.error) : 'Maaf, terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman.'}
            </p>
            <button onClick={() => window.location.reload()} className="bg-primary text-on-primary font-semibold text-sm h-[48px] px-6 rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer">
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
