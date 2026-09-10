import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Server, Database, Zap, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface ConnectivityStatus {
  mysql: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  pm2: string;
  timestamp: string;
}

export default function SystemConnectivity() {
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState<ConnectivityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/system-connectivity");
      setStatus(data);
    } catch (err) {
      setError("Failed to fetch system connectivity status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const StatusIcon = ({ connected }: { connected: boolean }) => 
    connected ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />;

  return (
    <div className="space-y-6">
      <PageHeader title="System Connectivity Monitor" subtitle="Real-time health status of infrastructure components" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Status */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <Database className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold">Database (MySQL)</h3>
            </div>
            {loading ? <Loader2 className="animate-spin w-6 h-6 text-zinc-400" /> : (
                <div className="flex items-center gap-2">
                    <StatusIcon connected={status?.mysql === "connected"} />
                    <span className="font-mono font-bold capitalize">{status?.mysql}</span>
                </div>
            )}
        </div>

        {/* Redis Status */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold">Redis Cache</h3>
            </div>
            {loading ? <Loader2 className="animate-spin w-6 h-6 text-zinc-400" /> : (
                <div className="flex items-center gap-2">
                    <StatusIcon connected={status?.redis === "connected"} />
                    <span className="font-mono font-bold capitalize">{status?.redis}</span>
                </div>
            )}
        </div>

        {/* PM2 Status */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                    <Server className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold">PM2 Process</h3>
            </div>
            {loading ? <Loader2 className="animate-spin w-6 h-6 text-zinc-400" /> : (
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold capitalize">{status?.pm2}</span>
                </div>
            )}
        </div>
      </div>
      
      <button onClick={fetchStatus} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-zinc-800">
        <RefreshCw className="w-4 h-4" /> Refresh Status
      </button>

      {error && <p className="text-rose-500 text-sm font-bold">{error}</p>}
      
      {status && <p className="text-zinc-400 text-[10px] font-mono">Last updated: {new Date(status.timestamp).toLocaleString()}</p>}
    </div>
  );
}
