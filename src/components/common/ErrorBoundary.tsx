import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    } catch {}
    window.location.reload();
  };

  private handleReset = () => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col items-center justify-between py-10 px-6 shadow-2xl border-x border-[#181820]/40 select-none overflow-hidden font-sans">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-[90px] pointer-events-none" />

          {/* Top Status */}
          <div className="w-full flex items-center justify-center pt-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Application Exception Caught</span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex flex-col items-center justify-center text-center my-auto w-full max-w-xs">
            <div className="relative flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-3xl bg-[#181820] border border-[#262630] flex items-center justify-center shadow-2xl">
                <AlertTriangle className="w-10 h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight mb-2">
              Something went wrong
            </h2>
            <p className="text-xs text-[#a1a1aa] leading-relaxed mb-6">
              The Mini App encountered an unexpected display issue. Your balance and ongoing orders are completely safe.
            </p>

            {this.state.error && (
              <div className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 mb-6 text-left">
                <span className="text-[10px] text-[#71717a] font-mono uppercase block mb-1">
                  Error Details:
                </span>
                <p className="text-[11px] font-mono text-red-400/90 break-all line-clamp-3">
                  {this.state.error.message || 'Unknown render exception'}
                </p>
              </div>
            )}

            {/* Actions: Minimum 44px hitboxes */}
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white font-bold text-xs shadow-violet-glow transition-all active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Mini App</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-xl bg-[#181820] hover:bg-[#20202a] border border-[#262630] text-[#a1a1aa] hover:text-white font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Try Returning Home</span>
              </button>
            </div>
          </div>

          {/* Footer Badge */}
          <div className="w-full flex items-center justify-center pb-2">
            <span className="text-[11px] text-[#52525b] font-mono">
              Krish Mini App • Production Error Recovery
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
