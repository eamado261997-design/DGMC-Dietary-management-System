import React from 'react';
import { WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from "../hooks/useNetworkStatus.js";
import { useAuth } from "../context/AuthContext.js";

export default function NetworkStatusBanner() {
  const isOnline = useNetworkStatus();
  const { isSyncing, queue, offlineWarningThreshold, conflicts, isAutoRetrying } = useAuth();
  
  const showSyncWarning = isOnline && queue.length > offlineWarningThreshold;
  const hasConflicts = conflicts.length > 0;
  
  if (isOnline && !isSyncing && !showSyncWarning && !hasConflicts && !isAutoRetrying) return null;

  return (
    <div className={`fixed top-0 left-0 w-full p-3 z-[9999] flex items-center justify-center gap-2 shadow-lg ${isSyncing || isAutoRetrying ? "bg-indigo-500 text-white" : hasConflicts ? "bg-rose-600 text-white" : showSyncWarning ? "bg-rose-500 text-white" : "bg-amber-500 text-white"}`}>
      {isSyncing || isAutoRetrying ? <Loader2 className="w-5 h-5 animate-spin" /> : hasConflicts ? <AlertCircle className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
      <span className="text-sm font-bold">
        {isAutoRetrying 
         ? "Auto-retrying sync..."
         : isSyncing 
           ? "Synchronizing offline data..." 
           : hasConflicts 
             ? `${conflicts.length} conflict(s) require attention.`
             : showSyncWarning 
               ? `Warning: ${queue.length} unsynchronized records exceed threshold of ${offlineWarningThreshold}.`
               : "Disconnected from server. Actions are being saved locally for synchronization."}
      </span>
    </div>
  );
}
