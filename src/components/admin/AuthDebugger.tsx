import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { getCookie } from "../../utils/cookie.js";
import { getApiBaseUrl } from "../../utils/apiConfig.js";
import { AlertCircle, CheckCircle, Shield, Key, Eye, X, Clock, User, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function AuthDebugger() {
  const { apiFetch, user, token } = useAuth();
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<any>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [showTokenInspector, setShowTokenInspector] = useState(false);

  const decodeToken = (t: string) => {
    try {
      if (!t || t.split('.').length !== 3) return null;
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Token decode error:", e);
      return null;
    }
  };

  const decodedToken = token ? decodeToken(token) : null;

  const runDiagnostic = () => {
    setLoading(true);
    apiFetch("/api/admin/auth-diagnostic")
      .then((data) => {
        setDiagnostic(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch auth diagnostic data");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (user?.role !== 'admin') return;
    runDiagnostic();
  }, [apiFetch, user]);

  const testPing = async (method: "GET" | "POST") => {
    setPingLoading(true);
    try {
      const startTime = Date.now();
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth-ping`, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": getCookie("XSRF-TOKEN")
        },
        ...(method === "POST" ? { body: JSON.stringify({ ping: "pong", timestamp: new Date().toISOString() }) } : {})
      });

      const latency = Date.now() - startTime;
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });

      let body;
      try {
        body = await res.json();
      } catch (e) {
        body = await res.text();
      }

      setPingResult({
        status: res.status,
        statusText: res.statusText,
        latency: `${latency}ms`,
        headers,
        body
      });
    } catch (err: any) {
      setPingResult({ error: err.message });
    } finally {
      setPingLoading(false);
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-inner space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="text-teal-400 w-6 h-6" />
            <h2 className="text-xl font-bold text-zinc-100">Auth Diagnostic Tool</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowTokenInspector(true)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black bg-amber-950/30 hover:bg-amber-900/40 text-amber-400 border border-amber-900/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Key className="w-3 h-3" />
              Token Inspector
            </button>
            <button 
              onClick={runDiagnostic}
              disabled={loading}
              className="text-[10px] uppercase tracking-widest font-black bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              Refresh Diagnostic
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-500">Loading diagnostic data...</div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/50">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        ) : diagnostic ? (
          <pre className="bg-zinc-900 p-4 rounded-lg overflow-x-auto text-xs text-zinc-300 font-mono">
            {JSON.stringify(diagnostic, null, 2)}
          </pre>
        ) : (
          <div className="text-zinc-500">No diagnostic data found.</div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Real-time Auth Ping Test</h3>
            <p className="text-xs text-zinc-500 mt-1">Troubleshoot 403 Forbidden errors by inspecting raw response headers.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => testPing("GET")}
              disabled={pingLoading}
              className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black uppercase tracking-tighter px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {pingLoading ? "Pinging..." : "Test GET Ping"}
            </button>
            <button 
              onClick={() => testPing("POST")}
              disabled={pingLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-black uppercase tracking-tighter px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {pingLoading ? "Pinging..." : "Test POST Ping"}
            </button>
          </div>
        </div>

        {pingResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className={`p-4 rounded-xl border ${pingResult.status >= 200 && pingResult.status < 300 ? 'bg-teal-950/20 border-teal-900/50 text-teal-400' : 'bg-red-950/20 border-red-900/50 text-red-400'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pingResult.status >= 200 && pingResult.status < 300 ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="font-bold">Status: {pingResult.status} {pingResult.statusText}</span>
                </div>
                <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded uppercase tracking-widest">{pingResult.latency}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest">Response Headers</span>
                <pre className="bg-zinc-900 p-4 rounded-lg overflow-x-auto text-[10px] text-zinc-400 font-mono h-48 border border-zinc-800 shadow-inner">
                  {JSON.stringify(pingResult.headers, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-[10px] font-black text-zinc-500 uppercase mb-2 block tracking-widest">Response Body</span>
                <pre className="bg-zinc-900 p-4 rounded-lg overflow-x-auto text-[10px] text-zinc-300 font-mono h-48 border border-zinc-800 shadow-inner">
                  {JSON.stringify(pingResult.body, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showTokenInspector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-950/50 p-2 rounded-xl border border-amber-900/30">
                    <Key className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">JWT Token Inspector</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Client-side manual decode</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTokenInspector(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {!token ? (
                  <div className="p-12 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-500">No authentication token found in storage.</p>
                  </div>
                ) : !decodedToken ? (
                  <div className="p-12 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-red-500/50 mx-auto" />
                    <p className="text-red-400 font-bold">Malformed Token</p>
                    <p className="text-zinc-500 text-sm">The current token structure is invalid and cannot be decoded.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                          <User className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Subject</span>
                        </div>
                        <p className="text-sm font-mono text-zinc-200 truncate">{decodedToken.sub || decodedToken.id || 'N/A'}</p>
                      </div>
                      <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2 text-teal-400 mb-2">
                          <Shield className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Role</span>
                        </div>
                        <p className="text-sm font-bold text-zinc-200">{decodedToken.role || 'N/A'}</p>
                      </div>
                      <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                          <Clock className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Expiry</span>
                        </div>
                        <p className="text-sm font-mono text-zinc-200">
                          {decodedToken.exp ? new Date(decodedToken.exp * 1000).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Decoded Claims (Raw JSON)</span>
                        {decodedToken.exp && decodedToken.exp * 1000 < Date.now() && (
                          <span className="text-[9px] font-black bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full uppercase">Token Expired</span>
                        )}
                      </div>
                      <pre className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto shadow-inner leading-relaxed">
                        {JSON.stringify(decodedToken, null, 2)}
                      </pre>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Encoded Token (Last 20 chars masked)</span>
                      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 break-all text-[10px] text-zinc-500 font-mono">
                        {token.substring(0, token.length - 20)}<span className="text-amber-500/50">********************</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 bg-zinc-900/30 border-t border-zinc-900 text-center">
                <button 
                  onClick={() => setShowTokenInspector(false)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 py-3 rounded-xl text-xs font-bold transition-all"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
