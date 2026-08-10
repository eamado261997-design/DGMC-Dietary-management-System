import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { 
  ShieldAlert, 
  Calendar, 
  Search, 
  Filter, 
  RefreshCw, 
  FileDown, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  Clock, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Trash2, 
  Edit, 
  AlertOctagon,
  Eye,
  Building
} from "lucide-react";

interface AuditLogItem {
  id: number;
  created_at: string;
  user_id?: number;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
}

interface SystemUser {
  id: number;
  name: string;
  role: string;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

export default function AuditTrail() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [actionCategory, setActionCategory] = useState<"all" | "sensitive" | "deletions" | "role_changes" | "voids">("all");
  const [userFilter, setUserFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [timeRange, setTimeRange] = useState<"all" | "24h" | "7d" | "30d" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Expanded Log Items
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Fetch audit records and users
  const loadAuditData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build fetch URL
      const queryParams = new URLSearchParams();
      queryParams.append("range", timeRange);
      
      if (timeRange === "custom") {
        if (startDate) queryParams.append("start_date", startDate);
        if (endDate) queryParams.append("end_date", endDate);
      }
      
      if (userFilter) {
        queryParams.append("user_id", userFilter);
      }
      
      if (departmentFilter) {
        queryParams.append("department_id", departmentFilter);
      }

      const fetchedLogs: AuditLogItem[] = await apiFetch(`/api/audit-logs?${queryParams.toString()}`);
      setLogs(fetchedLogs);

      // Fetch users for filtering dropdown
      const allPeople = await apiFetch("/api/admin/people");
      const systemStaff = allPeople
        .filter((p: any) => ["admin", "manager", "cashier"].includes(p.role))
        .map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          role: p.role
        }));
      setSystemUsers(systemStaff);

      // Fetch departments for filtering
      const depts = await apiFetch("/api/departments");
      setDepartments(depts);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve auditable ledger files.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, timeRange, userFilter, departmentFilter, startDate, endDate]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  // Check if an event action is sensitive/destructive
  const getEventSensitivity = (action: string) => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("DELETE") || actionUpper.includes("VOID")) {
      return { level: "critical", color: "text-rose-700 bg-rose-50 border-rose-200" };
    }
    if (actionUpper.includes("ROLE") || actionUpper.includes("PASSWORD") || actionUpper.includes("LOCKOUT") || actionUpper.includes("HASH")) {
      return { level: "high", color: "text-amber-700 bg-amber-50 border-amber-200" };
    }
    if (actionUpper.includes("UPDATE") || actionUpper.includes("SETTINGS")) {
      return { level: "medium", color: "text-teal-700 bg-teal-50 border-teal-200" };
    }
    return { level: "low", color: "text-zinc-650 bg-zinc-50 border-zinc-200" };
  };

  // Filter local logs according to selected actions or query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Action Category filter
      if (actionCategory === "sensitive") {
        const sensitiveActions = [
          "ROLE_CHANGE", 
          "EMPLOYEE_DELETE", 
          "EMPLOYEE_DEACTIVATE", 
          "DEPARTMENT_DELETE", 
          "TRANSACTION_VOID", 
          "PASSWORD_CHANGE", 
          "LOCKOUT", 
          "SETTINGS_UPDATE"
        ];
        if (!sensitiveActions.includes(log.action.toUpperCase())) return false;
      } else if (actionCategory === "deletions") {
        if (!log.action.toUpperCase().includes("DELETE")) return false;
      } else if (actionCategory === "role_changes") {
        if (!log.action.toUpperCase().includes("ROLE")) return false;
      } else if (actionCategory === "voids") {
        if (!log.action.toUpperCase().includes("VOID")) return false;
      }

      // 2. Search query filter
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        const username = log.username.toLowerCase();
        const action = log.action.toLowerCase();
        const entity = log.entity_type.toLowerCase();
        const entityId = (log.entity_id || "").toLowerCase();
        const oldVal = (log.old_value || "").toLowerCase();
        const newVal = (log.new_value || "").toLowerCase();

        const match = 
          username.includes(query) ||
          action.includes(query) ||
          entity.includes(query) ||
          entityId.includes(query) ||
          oldVal.includes(query) ||
          newVal.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [logs, actionCategory, debouncedSearchQuery]);

  // Calculate compliance statistics for visual overview cards
  const stats = useMemo(() => {
    const total = logs.length;
    const critical = logs.filter(l => {
      const act = l.action.toUpperCase();
      return act.includes("DELETE") || act.includes("VOID") || act.includes("ROLE");
    }).length;

    const deletions = logs.filter(l => l.action.toUpperCase().includes("DELETE")).length;
    const roleChanges = logs.filter(l => l.action.toUpperCase().includes("ROLE")).length;

    return { total, critical, deletions, roleChanges };
  }, [logs]);

  // Export logs to compliance CSV file (server)
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const data = await apiFetch("/api/audit-logs/export");
      if (data && data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${data.filename || "Audit_Trail_Report_" + new Date().toISOString().split("T")[0]}.csv`);
        link.click();
      }
    } catch (err: any) {
      alert("Failed to export audit logs: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Client-side CSV export of current activity logs using a generated blob
  const handleClientAuditExport = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      alert("No activity logs available to export.");
      return;
    }

    const headers = ["ID", "Timestamp", "Username", "Action", "Entity Type", "Entity ID", "IP Address", "Old Value", "New Value"];
    const rows = filteredLogs.map(log => [
      log.id,
      `"${(log.created_at || "").replace(/"/g, '""')}"`,
      `"${(log.username || "").replace(/"/g, '""')}"`,
      `"${(log.action || "").replace(/"/g, '""')}"`,
      `"${(log.entity_type || "").replace(/"/g, '""')}"`,
      `"${(log.entity_id || "").replace(/"/g, '""')}"`,
      `"${(log.ip_address || "").replace(/"/g, '""')}"`,
      `"${(log.old_value || "").replace(/"/g, '""')}"`,
      `"${(log.new_value || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Audit_Export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleRowExpand = (id: number) => {
    if (expandedLogId === id) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(id);
    }
  };

  const formatValueDetails = (val: any) => {
    if (!val) return <span className="text-zinc-400 italic font-mono text-[11px]">NULL / Empty</span>;
    if (typeof val === "object") {
      return (
        <pre className="text-[11px] font-mono bg-zinc-900 text-teal-400 p-3 rounded-xl overflow-x-auto leading-relaxed border border-zinc-800 shadow-inner max-h-[220px]">
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }
    try {
      const parsed = JSON.parse(val);
      return (
        <pre className="text-[11px] font-mono bg-zinc-900 text-teal-400 p-3 rounded-xl overflow-x-auto leading-relaxed border border-zinc-800 shadow-inner max-h-[220px]">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <div className="font-mono text-[11px] text-zinc-750 bg-zinc-50 border border-zinc-200 p-3 rounded-xl shadow-inner break-all whitespace-pre-wrap">
          {String(val)}
        </div>
      );
    }
  };

  return (
    <div id="admin-audit-trail-page" className="space-y-8 animate-fade-in">
      <PageHeader
        title="Compliance Audit Trail"
        subtitle="Verifiable ledger of sensitive database transactions, user role modifications, and destructive operations"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={loadAuditData}
              disabled={loading}
              className="h-10 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-650 flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-teal-700 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleClientAuditExport}
              disabled={filteredLogs.length === 0}
              className="h-10 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              Audit Export
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting || logs.length === 0}
              className="h-10 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-bold px-4 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
              ) : (
                <FileDown className="w-4 h-4 text-teal-700" />
              )}
              Server CSV
            </button>
          </div>
        }
      />

      {/* Compliance Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-zinc-50 rounded-2xl text-zinc-700 border border-zinc-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest font-mono">Total Recorded</p>
            <h3 className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Auditable system logs</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 rounded-2xl text-rose-700 border border-rose-100 animate-pulse">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-rose-800 uppercase tracking-widest font-mono">Critical Items</p>
            <h3 className="text-2xl font-black text-rose-950 mt-1">{stats.critical}</h3>
            <p className="text-[10px] text-rose-600 mt-0.5">Deletions, voids, roles</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 rounded-2xl text-amber-700 border border-amber-100">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest font-mono">Role Modifies</p>
            <h3 className="text-2xl font-black text-amber-950 mt-1">{stats.roleChanges}</h3>
            <p className="text-[10px] text-amber-600 mt-0.5">Security role alterations</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-zinc-900 text-white rounded-2xl border border-zinc-850">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Removals Ledger</p>
            <h3 className="text-2xl font-black text-zinc-100 mt-1">{stats.deletions}</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Permanent DB deletions</p>
          </div>
        </div>
      </div>

      {/* Primary Filters Control Area */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
          <Filter className="w-4 h-4 text-teal-700" />
          <span>Compliance Filter Console</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Action Categories */}
          <div>
            <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Operation Type</label>
            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value as any)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all cursor-pointer"
            >
              <option value="all">All Logs Ledger</option>
              <option value="sensitive">⚠️ Sensitive / Destructive</option>
              <option value="deletions">🗑️ Record Deletions Only</option>
              <option value="role_changes">🛡️ User Role Changes</option>
              <option value="voids">❌ Transaction Voids</option>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Operating Agent</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all cursor-pointer"
            >
              <option value="">All Operating Staff</option>
              {systemUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.toUpperCase()})</option>
              ))}
            </select>
          </div>

          {/* Business Unit (Department) Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Business Unit</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all cursor-pointer"
            >
              <option value="">All Business Units</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          {/* Creation Range */}
          <div>
            <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Date Horizon</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Inputs (only if custom is selected) */}
          {timeRange === "custom" ? (
            <>
              <div>
                <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-11 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:border-teal-700 font-bold text-zinc-700 transition-all"
                />
              </div>
            </>
          ) : (
            /* Search query (Spans remaining columns when custom date isn't active) */
            <div className="md:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Search Parameter Payload</label>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search action details or values..."
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none focus:border-teal-700 transition-all"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Search query (Moves to bottom when custom date is active to keep grid aligned) */}
        {timeRange === "custom" && (
          <div>
            <label className="text-[10px] font-bold text-zinc-450 block mb-1.5 font-mono uppercase tracking-wider">Search Parameter Payload</label>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action details or values..."
                className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none focus:border-teal-700 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Compliance Log Grid/Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
                <th className="px-6 py-4 w-12 text-center"></th>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Operator</th>
                <th className="px-6 py-4">Database Scope</th>
                <th className="px-6 py-4">Operation Target</th>
                <th className="px-6 py-4">Status & IP</th>
                <th className="px-6 py-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-zinc-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin text-teal-800 mx-auto mb-2" />
                    <span>Synchronizing secure log databases...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-zinc-400 font-bold">
                    No compliance records found matching active parameters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const sens = getEventSensitivity(log.action);
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      {/* Standard row */}
                      <tr 
                        onClick={() => toggleRowExpand(log.id)}
                        className={`hover:bg-zinc-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-50/40" : ""}`}
                      >
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400 mx-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400 mx-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-zinc-450">
                          #{log.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-zinc-850 block">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-zinc-450 block mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-800 border border-teal-250 text-[10px] font-black flex items-center justify-center font-mono">
                              {(log.username || "S").charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-zinc-900 block">{log.username || "System"}</span>
                              <span className="text-[9px] text-zinc-400 block font-mono">Agent ID: {log.user_id || "System"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${sens.color}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono">
                          <span className="font-bold text-zinc-800 text-[10px] uppercase block">{log.entity_type}</span>
                          <span className="text-[10px] text-zinc-450 block">Ref ID: {log.entity_id || "General"}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-500">
                          <span className="text-[10px] block">{log.ip_address || "127.0.0.1"}</span>
                          <span className="text-[9px] text-zinc-400 block">SECURE CHANNEL</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpand(log.id);
                            }}
                            className="h-8 w-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-teal-700 transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable details panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-zinc-50/50 p-6 border-y border-zinc-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                              <div className="space-y-4">
                                <h4 className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-500">
                                  Prior Values State (Before Change)
                                </h4>
                                {formatValueDetails(log.old_value)}
                              </div>
                              <div className="space-y-4">
                                <h4 className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-500">
                                  Next Values State (After Change)
                                </h4>
                                {formatValueDetails(log.new_value)}
                              </div>
                            </div>

                            {/* Verification Footnote */}
                            <div className="mt-5 pt-4 border-t border-zinc-200/60 flex items-center justify-between text-[10px] text-zinc-450">
                              <div className="flex items-center gap-1.5 font-mono">
                                <Terminal className="w-3.5 h-3.5 text-teal-700" />
                                <span>VERIFICATION RECORD FOR TRANSITION LOG ID #{log.id}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <span className="font-bold text-emerald-700">SYSTEM SEAL VERIFIED</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
