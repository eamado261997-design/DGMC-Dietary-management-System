import React from 'react';
import { RefreshCw, Download, Upload, AlertCircle } from 'lucide-react';

interface SyncConflictItemProps {
  key?: React.Key;
  conflict: {
    id: number;
    offlineData: any;
    serverData: any;
  };
  onResolve: (id: number, action: 'merge' | 'overwrite', data?: any) => void;
}

export default function SyncConflictItem({ conflict, onResolve }: SyncConflictItemProps) {
  return (
    <div className="bg-white border border-rose-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6 text-rose-800">
        <AlertCircle className="w-6 h-6" />
        <h3 className="text-lg font-black">Data Conflict Detected</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
          <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3 text-center">Local (Offline)</h4>
          <pre className="text-xs font-mono text-zinc-900 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(conflict.offlineData, null, 2)}
          </pre>
        </div>
        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
          <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3 text-center">Server</h4>
          <pre className="text-xs font-mono text-zinc-900 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(conflict.serverData, null, 2)}
          </pre>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={() => onResolve(conflict.id, 'overwrite')}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800"
        >
          <Download className="w-4 h-4" /> Keep Server Version
        </button>
        <button 
          onClick={() => onResolve(conflict.id, 'merge', conflict.offlineData)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700"
        >
          <Upload className="w-4 h-4" /> Keep Local Version
        </button>
      </div>
    </div>
  );
}
