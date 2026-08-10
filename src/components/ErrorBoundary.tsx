import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl border border-zinc-200 p-8 shadow-2xl">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h1 className="text-xl font-black text-zinc-900 text-center mb-2 tracking-tight">
              Interface Sync Interrupted
            </h1>
            
            <p className="text-sm text-zinc-500 text-center mb-8 leading-relaxed">
              The application encountered an unexpected runtime exception. This may be due to temporary network instability or an unhandled state conflict.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full h-11 bg-zinc-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              
              <button
                onClick={() => window.location.href = "/"}
                className="w-full h-11 bg-white border border-zinc-200 text-zinc-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-50 transition-all"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100">
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest text-center mb-2">
                System Diagnostic Trace
              </div>
              <div className="bg-zinc-50 rounded-lg p-3 max-h-32 overflow-y-auto border border-zinc-100">
                <code className="text-[10px] text-zinc-400 break-all leading-tight">
                  {this.state.error?.message || "Internal Exception Trace"}
                </code>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
