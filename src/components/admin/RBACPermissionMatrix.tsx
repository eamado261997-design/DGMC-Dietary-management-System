import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Shield, Check, X, AlertTriangle, Info, Lock, Globe } from "lucide-react";

interface RouteDoc {
  path: string;
  method: string;
  description: string;
  authenticationRequired?: boolean;
  roles?: string[];
  requestPayload?: any;
}

interface RbacData {
  service: string;
  version: string;
  routes: RouteDoc[];
}

interface VerificationData {
  enforcedRoutes: { path: string; method?: string; enforcedRoles: string[] }[];
}

export default function RBACPermissionMatrix() {
  const { apiFetch, user } = useAuth();
  const [data, setData] = useState<RbacData | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    Promise.all([
      apiFetch("/api/docs"),
      apiFetch("/api/admin/security-matrix-verify")
    ])
      .then(([docJson, verifyJson]) => {
        setData(docJson);
        setVerification(verifyJson);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Failed to fetch RBAC configuration");
        setLoading(false);
      });
  }, [apiFetch, user]);

  if (user?.role !== 'admin') return null;

  const roles = ["admin", "manager", "cashier", "employee"];

  const getInconsistency = (route: RouteDoc) => {
    if (!verification) return null;
    
    // Find matching path and method in verification data
    const enforced = verification.enforcedRoutes.find(er => {
      // Handle heuristic where method might be missing in older data or simpler regex matches
      const pathMatch = er.path === route.path;
      if (!er.method) return pathMatch;
      return pathMatch && er.method === route.method;
    });
    if (!enforced) return null;

    const docRoles = (route.roles || []).sort();
    const realRoles = (enforced.enforcedRoles || []).sort();

    if (JSON.stringify(docRoles) !== JSON.stringify(realRoles)) {
      return {
        expected: docRoles,
        actual: realRoles
      };
    }
    return null;
  };

  const getRoleStatus = (route: RouteDoc, role: string) => {
    if (!route.authenticationRequired) return "public";
    if (!route.roles) return "authenticated"; // All logged in users
    return route.roles.includes(role) ? "permitted" : "denied";
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Lock className="text-amber-400 w-6 h-6" />
          <h2 className="text-xl font-bold text-zinc-100">RBAC Permission Matrix</h2>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Check className="w-3 h-3" /> Permitted
          </div>
          <div className="flex items-center gap-1.5 text-zinc-600">
            <X className="w-3 h-3" /> Denied
          </div>
          <div className="flex items-center gap-1.5 text-teal-400">
            <Globe className="w-3 h-3" /> Public
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 animate-pulse">Analyzing route security configurations...</div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-4 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Route & Method</th>
                {roles.map(role => (
                  <th key={role} className="py-4 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                    {role}
                  </th>
                ))}
                <th className="py-4 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Security Mode</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(data?.routes) && data.routes.map((route, idx) => {
                const inconsistency = getInconsistency(route);
                return (
                  <tr key={idx} className={`border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors group ${inconsistency ? 'bg-red-950/10' : ''}`}>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            route.method === 'GET' ? 'bg-blue-950/50 text-blue-400 border border-blue-900/30' :
                            route.method === 'POST' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/30' :
                            route.method === 'PUT' ? 'bg-amber-950/50 text-amber-400 border border-amber-900/30' :
                            'bg-red-950/50 text-red-400 border border-red-900/30'
                          }`}>
                            {route.method}
                          </span>
                          <span className="text-sm font-mono text-zinc-300">{route.path}</span>
                          {inconsistency && (
                            <div className="group/warn relative">
                              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse cursor-help" />
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover/warn:block z-50 w-64 p-3 bg-red-950 border border-red-900 rounded-xl shadow-2xl text-[10px] text-red-200">
                                <p className="font-bold mb-1">RBAC DRIFT DETECTED</p>
                                <p className="opacity-80 mb-2">Documentation mismatch with code enforcement.</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-zinc-500 font-bold">DOCS:</p>
                                    <p>{inconsistency.expected.join(', ') || 'None'}</p>
                                  </div>
                                  <div>
                                    <p className="text-zinc-500 font-bold">CODE:</p>
                                    <p>{inconsistency.actual.join(', ') || 'None'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-1 leading-relaxed max-w-xs">{route.description}</span>
                      </div>
                    </td>
                    {roles.map(role => {
                    const status = getRoleStatus(route, role);
                    return (
                      <td key={role} className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {status === "public" ? (
                            <Globe className="w-4 h-4 text-teal-500/50" />
                          ) : status === "permitted" || status === "authenticated" ? (
                            <div className="bg-emerald-950/30 p-1 rounded-md border border-emerald-900/30">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                          ) : (
                            <X className="w-3.5 h-3.5 text-zinc-800" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {!route.authenticationRequired ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-teal-950/20 border border-teal-900/30">
                          <Globe className="w-3 h-3 text-teal-400" />
                          <span className="text-[9px] font-black uppercase text-teal-400">Anonymous</span>
                        </div>
                      ) : !route.roles ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-950/20 border border-blue-900/30">
                          <Shield className="w-3 h-3 text-blue-400" />
                          <span className="text-[9px] font-black uppercase text-blue-400">Any Authenticated</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-950/20 border border-amber-900/30">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-[9px] font-black uppercase text-amber-400">Strict RBAC</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-zinc-800">
        <div className="flex items-start gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">Diagnostic Intelligence</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This matrix is generated from the <code className="text-zinc-200">/api/docs</code> service registry. 
              Inconsistencies often occur when the hardcoded route handlers in <code className="text-zinc-200">src/server/api.ts</code> 
              differ from this documentation. If you experience a 403 error on a route that shows green above, check for 
              <code className="text-zinc-200">requireRole()</code> calls in the actual implementation block.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
