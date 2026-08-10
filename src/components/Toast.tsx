import React, { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type = 'error', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`fixed top-4 right-4 z-50 border shadow-xl rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${colors[type]}`}>
      <AlertCircle className="w-5 h-5 shrink-0" />
      <p className="text-xs font-medium pr-2">{message}</p>
      <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
