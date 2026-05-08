import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { hardReload } from "utils/reloadUtils";

interface Props {
  children?: ReactNode;
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
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
          return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white font-noto">
          <div className="bg-slate-800 p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl border border-slate-700">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-black mb-4">অ্যাপ ক্রাশ হয়েছে! (App Crashed)</h1>
            <div className="bg-slate-900 p-4 rounded-xl text-left overflow-auto max-h-48 mb-6 border border-slate-700 relative">
               <p className="text-red-400 font-mono text-sm break-all font-bold">{this.state.error?.toString()}</p>
               {this.state.errorInfo && <p className="text-slate-400 font-mono text-xs mt-2 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</p>}
            </div>
            <p className="text-slate-400 mb-8 text-sm">দয়া করে নিচে দেওয়া Error এর স্ক্রিনশট ডেভেলপার কে দিন।</p>
            <div className="flex flex-col gap-3">
                <button
                onClick={() => hardReload()}
                className="w-full py-4 bg-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-white"
                >
                <RefreshCw size={18} /> রিলোড করুন
                </button>
                <button
                onClick={() => { localStorage.clear(); hardReload(); }}
                className="w-full py-4 bg-slate-700 rounded-xl font-bold active:scale-95 transition-all text-white"
                >
                লগ আউট ও ক্যাশ ক্লিয়ার করুন
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
