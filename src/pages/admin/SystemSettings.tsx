import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { 
  Settings, 
  Settings2, 
  FileDown, 
  Calendar, 
  Search, 
  Filter, 
  RefreshCw, 
  Upload, 
  Eye, 
  Check, 
  AlertCircle, 
  DollarSign, 
  Clock, 
  Activity, 
  Building,
  BarChart3,
  Database,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Terminal,
  Copy,
  Wrench,
  ShieldCheck,
  Lock as LockIcon
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import SyncConflicts from "../../components/SyncConflicts.js";
import RBACVisualizer from "../../components/admin/RBACVisualizer.js";


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

interface SettingConfig {
  id: number;
  setting_key: string;
  setting_value: string;
}

export default function SystemSettings() {
  const { apiFetch, branding, refreshBranding, theme, setTheme } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"branding" | "shifts" | "audit-logs" | "offline-data" | "backup" | "diagnostics" | "rbac">("branding");
  const { queue, autoSync, setAutoSync, syncLogs, offlineWarningThreshold, setOfflineWarningThreshold, resolutionStrategy, setResolutionStrategy, autoRetryInterval, setAutoRetryInterval, conflicts, resolveConflict } = useAuth();
  
  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoadingDiagnostics(true);
    setDiagnosticsError(null);
    try {
      const data = await apiFetch("/api/admin/sys-health");
      if (data && data.success) {
        setDiagnostics(data);
      } else {
        throw new Error(data?.error || "Failed to retrieve diagnostics data");
      }
    } catch (err: any) {
      console.error("Error fetching diagnostics:", err);
      setDiagnosticsError(err.message || "Failed to retrieve database diagnostics.");
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "diagnostics") {
      fetchDiagnostics();
    }
  }, [activeTab]);
  
  const queueStats = React.useMemo(() => {
    const count = queue.length;
    const sizeInBytes = new TextEncoder().encode(JSON.stringify(queue)).length;
    const sizeKB = (sizeInBytes / 1024).toFixed(2);
    return { count, sizeKB };
  }, [queue]);

  // Loading states
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [generatingBackup, setGeneratingBackup] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  const handleCopySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  // Messages
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Settings State variables
  const [companyName, setCompanyName] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₱");
  const [mealPrice, setMealPrice] = useState("150.00");
  const [itSupportPhone, setItSupportPhone] = useState("Medical arts Bldg. 5th floor/ICT dept. / 2568");
  const [logoBase64, setLogoBase64] = useState("");

  // Shift Settings State variables
  const [dayStart, setDayStart] = useState("11:00");
  const [dayEnd, setDayEnd] = useState("14:00");
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");


  // Other rule properties in the system settings
  const [minPasswordLength, setMinPasswordLength] = useState("8");
  const [freeMealLimitDaily, setFreeMealLimitDaily] = useState("1");
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState("30");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const debouncedSearchFilter = useDebounce(searchFilter, 300);
  const [systemUsers, setSystemUsers] = useState<{ id: number; name: string }[]>([]);

  // Fetch all system settings from database
  const fetchSettings = async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const data: SettingConfig[] = await apiFetch("/api/settings");
      
      // Update state matching database records
      const kv: Record<string, string> = {};
      data.forEach(item => {
        kv[item.setting_key] = item.setting_value;
      });

      if (kv["company_name"]) setCompanyName(kv["company_name"]);
      if (kv["company_tagline"]) setCompanyTagline(kv["company_tagline"]);
      if (kv["currency_symbol"]) setCurrencySymbol(kv["currency_symbol"]);
      if (kv["meal_price"]) setMealPrice(kv["meal_price"]);
      if (kv["it_support_phone"]) setItSupportPhone(kv["it_support_phone"]);
      if (kv["company_logo_url"]) setLogoBase64(kv["company_logo_url"]);
      
      if (kv["shift_day_start"]) setDayStart(kv["shift_day_start"]);
      if (kv["shift_day_end"]) setDayEnd(kv["shift_day_end"]);
      if (kv["shift_night_start"]) setNightStart(kv["shift_night_start"]);
      if (kv["shift_night_end"]) setNightEnd(kv["shift_night_end"]);

      if (kv["min_password_length"]) setMinPasswordLength(kv["min_password_length"]);
      if (kv["free_meal_limit_daily"]) setFreeMealLimitDaily(kv["free_meal_limit_daily"]);
      if (kv["audit_log_retention_days"]) setAuditLogRetentionDays(kv["audit_log_retention_days"]);

    } catch (err: any) {
      setSettingsError(err.message || "Failed to retrieve configuration rules.");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Fetch real-time Audit logs (optionally limited)
  const fetchAuditLogs = async (limit?: number) => {
    setLogsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (!limit) {
        if (actionFilter) queryParams.append("action", actionFilter);
        if (userFilter) queryParams.append("user_id", userFilter);
        if (rangeFilter) queryParams.append("range", rangeFilter);
      }
      
      const logs: AuditLogItem[] = await apiFetch(`/api/audit-logs?${queryParams.toString()}`);
      if (limit) {
        setAuditLogs(logs.slice(0, limit));
      } else {
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error("Audit log retrieval failed", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch unique system users who created logs
  const fetchSystemUsers = async () => {
    try {
      const people = await apiFetch("/api/admin/people");
      if (Array.isArray(people)) {
        const usersList = people.map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name} (${p.role === "admin" ? "Admin" : p.role === "manager" ? "Manager" : "Staff"})`
        }));
        setSystemUsers(usersList);
      }
    } catch (err) {
      console.error("Failed to load user list for filter", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchSystemUsers();
    fetchAuditLogs(5); // Fetch latest 5 on mount
  }, []);

  useEffect(() => {
    if (activeTab === "audit-logs") {
      fetchAuditLogs();
    }
  }, [activeTab, actionFilter, userFilter, rangeFilter]);

  // Handle saving of settings block
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);

    // Prepare settings array
    const payload = {
      settings: [
        { setting_key: "company_name", setting_value: companyName },
        { setting_key: "company_tagline", setting_value: companyTagline },
        { setting_key: "currency_symbol", setting_value: currencySymbol },
        { setting_key: "meal_price", setting_value: mealPrice },
        { setting_key: "it_support_phone", setting_value: itSupportPhone },
        { setting_key: "shift_day_start", setting_value: dayStart },
        { setting_key: "shift_day_end", setting_value: dayEnd },
        { setting_key: "shift_night_start", setting_value: nightStart },
        { setting_key: "shift_night_end", setting_value: nightEnd },
        { setting_key: "min_password_length", setting_value: minPasswordLength },
        { setting_key: "free_meal_limit_daily", setting_value: freeMealLimitDaily },
        { setting_key: "audit_log_retention_days", setting_value: auditLogRetentionDays }
      ]
    };

    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res && res.success) {
        setSettingsSuccess("System configurations updated successfully.");
        await refreshBranding();
        setTimeout(() => setSettingsSuccess(null), 4000);
      } else {
        throw new Error(res.error || "Save operation failed.");
      }
    } catch (err: any) {
      setSettingsError(err.message || "Failed to update system settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger Audit CSV Sheet exports
  const handleExportAuditLogs = async () => {
    try {
      const data = await apiFetch("/api/audit-logs/export");
      if (data && data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${data.filename || "Audit_Logs_" + new Date().toISOString().split("T")[0]}.csv`);
        link.click();
      }
    } catch (err: any) {
      alert("Failed to export logs: " + err.message);
    }
  };

  // Secure Database ZIP Backup download trigger
  const handleDownloadBackup = async () => {
    setGeneratingBackup(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const data = await apiFetch("/api/admin/db-zip-export");
      if (data && data.success && data.zipBase64) {
        // Safe standard base64 decoding to binary array
        const byteCharacters = atob(data.zipBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/zip" });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", data.filename || `dgmc_encrypted_backup_${new Date().toISOString().split("T")[0]}.zip`);
        link.click();
        
        setSettingsSuccess("Secure database ZIP backup successfully generated and downloaded!");
        setTimeout(() => setSettingsSuccess(null), 5000);
      } else {
        throw new Error(data?.error || "Invalid response from backup server");
      }
    } catch (err: any) {
      console.error("Backup trigger failed:", err);
      setSettingsError(err.message || "Failed to generate secure ZIP database backup.");
    } finally {
      setGeneratingBackup(false);
    }
  };

  // Local client-side filters for Audit logs
  const filteredLogs = auditLogs.filter(log => {
    if (!debouncedSearchFilter) return true;
    const term = debouncedSearchFilter.toLowerCase();
    return (
      log.username.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(term)) ||
      (log.new_value && String(log.new_value).toLowerCase().includes(term)) ||
      (log.old_value && String(log.old_value).toLowerCase().includes(term))
    );
  });

  return (
    <div id="system-settings-page">
      <PageHeader
        title="System Configuration"
        subtitle="Manage dynamic hospital branding, shift timing eligibilities, and inspect high-fidelity audit trails"
      />

      {/* Tabs list */}
      <div className="flex border-b border-zinc-200 mb-6 gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab("branding")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "branding" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-650"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          General &amp; Hospital Branding
        </button>
        <button
          onClick={() => setActiveTab("shifts")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "shifts" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <Clock className="w-4 h-4" />
          Shift Timing Parameters
        </button>
        <button
          onClick={() => setActiveTab("audit-logs")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "audit-logs" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <Activity className="w-4 h-4" />
          Detailed Audit Ledger
        </button>
        <button
          onClick={() => setActiveTab("offline-data")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "offline-data" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <Upload className="w-4 h-4" />
          Offline Data Queue
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "backup" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <FileDown className="w-4 h-4" />
          Database ZIP Backup
        </button>
        <button
          onClick={() => setActiveTab("diagnostics")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "diagnostics" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <Activity className="w-4 h-4" />
          Database Diagnostics
        </button>
        <button
          onClick={() => setActiveTab("rbac")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg flex items-center gap-1.5 ${
            activeTab === "rbac" ? "border-teal-700 text-teal-850" : "border-transparent text-zinc-400 hover:text-zinc-655"
          }`}
        >
          <LockIcon className="w-4 h-4" />
          RBAC Config
        </button>
      </div>

      {/* Error & Success indicators */}
      {settingsError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Execution Cancelled</p>
            <p className="mt-0.5">{settingsError}</p>
          </div>
        </div>
      )}

      {settingsSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 text-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">System Updated</p>
            <p className="mt-0.5">{settingsSuccess}</p>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TAB VIEW */}
      {settingsLoading ? (
        <div className="flex justify-center py-24 bg-white border border-zinc-200 rounded-3xl">
          <VitalSignsLoader size="md" color="teal" />
        </div>
      ) : (
        <>
          {/* TAB 1: General & Hospital Branding */}
          {activeTab === "branding" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Config Block */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-6 font-mono">Branding &amp; Policy Configurations</h3>
                  
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Hospital / Organization Name</label>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Divine Grace Medical Center"
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Branding Subtitle/Tagline</label>
                        <input
                          type="text"
                          value={companyTagline}
                          onChange={(e) => setCompanyTagline(e.target.value)}
                          placeholder="e.g. Compassionate Care, Exceptional Service"
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-zinc-100 pt-5">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Currency Symbol</label>
                        <input
                          type="text"
                          required
                          value={currencySymbol}
                          onChange={(e) => setCurrencySymbol(e.target.value)}
                          placeholder="₱"
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Individual Meal Base Price</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-400">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={mealPrice}
                            onChange={(e) => setMealPrice(e.target.value)}
                            placeholder="150.00"
                            className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">IT Access Support Contact / Extension Number</label>
                      <input
                        type="text"
                        required
                        value={itSupportPhone}
                        onChange={(e) => setItSupportPhone(e.target.value)}
                        placeholder="e.g. Medical arts Bldg. 5th floor/ICT dept. / 2568"
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                      />
                      <span className="text-[10px] text-zinc-450 mt-1 block">Displayed on the hospital login page for personnel needing credential or login support.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-zinc-100 pt-5">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Free Meal Allotment Limit</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={freeMealLimitDaily}
                          onChange={(e) => setFreeMealLimitDaily(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                        <span className="text-[9px] text-zinc-450 mt-1 block">Maximum free claims per shift</span>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Minimum Password Character Length</label>
                        <input
                          type="number"
                          min="4"
                          required
                          value={minPasswordLength}
                          onChange={(e) => setMinPasswordLength(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                        <span className="text-[9px] text-zinc-450 mt-1 block">Authentication rule restriction</span>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-450 block mb-1.5 font-mono">Audit Log Retention Limit</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={auditLogRetentionDays}
                          onChange={(e) => setAuditLogRetentionDays(e.target.value)}
                          className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                        />
                        <span className="text-[9px] text-zinc-450 mt-1 block">Retention period in days</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-150 pt-6 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="h-10 bg-teal-800 hover:bg-teal-950 disabled:bg-teal-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider px-6 flex items-center gap-2 transition-colors"
                      >
                        {savingSettings ? "Applying changes..." : "Save Config Rules"}
                      </button>
                    </div>
                  </form>
                </div>
                
                {/* Recent Security Audit Widget */}
                <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-6 font-mono">Recent Security Audit</h3>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-zinc-400">No audit logs found.</p>
                  ) : (
                    <div className="space-y-4">
                      {auditLogs.map(log => (
                        <div key={log.id} className="flex items-center gap-4 text-xs border-b border-zinc-100 pb-4">
                          <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center font-mono font-bold shrink-0">
                            {(log.username || "S").charAt(0)}
                          </span>
                          <div className="flex-grow">
                             <p className="font-bold text-zinc-800">{log.action}</p>
                             <p className="text-[10px] text-zinc-500">{new Date(log.created_at).toLocaleString()}</p>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded">{log.entity_type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setActiveTab("audit-logs")} className="text-xs text-teal-800 font-bold mt-4 hover:underline">View Full Audit Ledger</button>
                </div>
              </div>

              {/* Sidebar Config Section */}
              <div className="space-y-6">
                {/* Official Institution Branding Card (Locked) */}
                <div className="bg-white rounded-3xl border border-zinc-200 p-6 flex flex-col items-center justify-between">
                  <div className="w-full text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-wider mb-3">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Official Master Branding</span>
                    </div>
                    <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider mb-1 font-mono">
                      Divine Grace Medical Center Logo
                    </h3>
                    <p className="text-xs text-zinc-500 mb-4">
                      A Mount Grace Hospital • Permanent Official System Logo
                    </p>

                    {/* Official Logo Display */}
                    <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto overflow-hidden">
                      <img
                        src="/assets/dgmc-logo.png?v=3"
                        alt="Divine Grace Medical Center Logo"
                        className="max-h-28 max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <div className="w-full mt-4 p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-indigo-950">
                      Divine Grace Medical Center Logo Active
                    </p>
                    <p className="text-[10px] text-indigo-700 mt-0.5">
                      Standardized across all headers, QR badges, portals, and formal PDF reports.
                    </p>
                  </div>
                </div>

                {/* Theme Selector Toggle Card */}
                <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 space-y-4">
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider font-mono">System Visual Theme</h3>
                  <p className="text-xs text-zinc-450 leading-relaxed">
                    Choose between a bright, clean healthcare environment style or a dark, high-contrast visual display optimized for eye safety and readability.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        theme === "light"
                          ? "border-teal-700 bg-teal-50 text-teal-950 font-bold"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <div>
                        <p className="text-xs uppercase font-mono font-bold tracking-wide">Clinical Light Mode</p>
                        <p className="text-[10px] text-zinc-450 mt-1 font-normal leading-normal">Optimized for well-lit office environments and high-daylight readability.</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${theme === "light" ? "border-teal-800 bg-teal-800" : "border-zinc-300"}`}>
                        {theme === "light" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        theme === "dark"
                          ? "border-teal-500 bg-teal-950 text-white font-bold"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <div>
                        <p className="text-xs uppercase font-mono font-bold tracking-wide">High Contrast Dark Mode</p>
                        <p className="text-[10px] text-zinc-450 mt-1 font-normal leading-normal">Deep blacks and vivid contrast for low-light night shifts and maximum accessibility.</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${theme === "dark" ? "border-teal-400 bg-teal-500" : "border-zinc-300"}`}>
                        {theme === "dark" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Shift Timing Parameters */}
          {activeTab === "shifts" && (
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 md:p-8 max-w-3xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-980 mb-2 font-mono uppercase tracking-wider">
                <Clock className="w-5 h-5 text-teal-700" />
                <span>Duty Shift Window Configurations</span>
              </div>
              <p className="text-xs text-zinc-500 mb-8 leading-relaxed">
                Determine the allowed hour windows when scheduled personnel can generate tokens &amp; claim cafeteria food tickets.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-8">

                {/* Day Shift */}
                <div className="border border-zinc-150 rounded-2xl p-5 bg-zinc-50 text-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="font-extrabold text-zinc-900 font-sans text-sm">Day Shift Window Parameters</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-550 block mb-1">Window Starts Around</label>
                      <input
                        type="time"
                        required
                        value={dayStart}
                        onChange={(e) => setDayStart(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-white text-xs text-zinc-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-550 block mb-1">Window Closes Around</label>
                      <input
                        type="time"
                        required
                        value={dayEnd}
                        onChange={(e) => setDayEnd(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-white text-xs text-zinc-900 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Night Shift */}
                <div className="border border-zinc-150 rounded-2xl p-5 bg-zinc-50 text-xs">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span className="font-extrabold text-zinc-900 font-sans text-sm">Night Shift Window Parameters</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-555 block mb-1">Window Starts Around</label>
                      <input
                        type="time"
                        required
                        value={nightStart}
                        onChange={(e) => setNightStart(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-white text-xs text-zinc-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-555 block mb-1">Window Closes Around (Next Day)</label>
                      <input
                        type="time"
                        required
                        value={nightEnd}
                        onChange={(e) => setNightEnd(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-white text-xs text-zinc-900 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-150 pt-6 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="h-10 bg-teal-800 hover:bg-teal-950 disabled:bg-teal-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider px-6 flex items-center gap-2 transition-colors"
                  >
                    {savingSettings ? "Saving Parameters..." : "Save Timing Rules"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Detailed Audit Ledger */}
          {activeTab === "audit-logs" && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                    <Filter className="w-4 h-4 text-teal-700" />
                    <span>Filter Dynamic Audit Records</span>
                  </div>
                  <button
                    onClick={handleExportAuditLogs}
                    className="h-9 bg-zinc-800 hover:bg-zinc-900 border border-zinc-200 text-white rounded-xl text-xs font-bold px-3.5 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Full Audit Logs (CSV)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider font-bold">Search values</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Search action or parameters..."
                        className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider font-bold">Search Action Type</label>
                    <select
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none text-zinc-600 font-bold"
                    >
                      <option value="">All Auditable Actions</option>
                      <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
                      <option value="EMPLOYEE_CREATE">EMPLOYEE_CREATE</option>
                      <option value="EMPLOYEE_UPDATE">EMPLOYEE_UPDATE</option>
                      <option value="EMPLOYEE_DEACTIVATE">EMPLOYEE_DEACTIVATE</option>
                      <option value="EMPLOYEE_DELETE">EMPLOYEE_DELETE</option>
                      <option value="USER_CREATE">USER_CREATE</option>
                      <option value="ROLE_CHANGE">ROLE_CHANGE</option>
                      <option value="DEPARTMENT_CREATE">DEPARTMENT_CREATE</option>
                      <option value="DEPARTMENT_UPDATE">DEPARTMENT_UPDATE</option>
                      <option value="DEPARTMENT_DELETE">DEPARTMENT_DELETE</option>
                      <option value="SCHEDULE_PUBLISH">SCHEDULE_PUBLISH</option>
                      <option value="TRANSACTION_VOID">TRANSACTION_VOID</option>
                      <option value="SETTINGS_UPDATE">SETTINGS_UPDATE</option>
                      <option value="BRANDING_LOGO_UPDATE">BRANDING_LOGO_UPDATE</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider font-bold">Auditor User Account</label>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none text-zinc-600 font-bold"
                    >
                      <option value="">All Users</option>
                      {systemUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-650 block mb-1 font-mono uppercase tracking-wider font-bold">Creation Range</label>
                    <select
                      value={rangeFilter}
                      onChange={(e) => setRangeFilter(e.target.value)}
                      className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none text-zinc-600 font-bold"
                    >
                      <option value="all">All Time</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                        <th className="px-6 py-4">Logs ID</th>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Operating Agent</th>
                        <th className="px-6 py-4">Operation Scope</th>
                        <th className="px-6 py-4">Scope DB / ID</th>
                        <th className="px-6 py-4">Prior Parameters</th>
                        <th className="px-6 py-4">Next Parameters</th>
                        <th className="px-6 py-4">Operating IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                      {logsLoading ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-bold">
                            <RefreshCw className="w-6 h-6 animate-spin text-teal-800 mx-auto mb-2" />
                            <span>Updating auditable records...</span>
                          </td>
                        </tr>
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-bold">
                            No logs registered complying with parameters
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => {
                          const formatPayload = (val: any) => {
                            if (!val) return "—";
                            if (typeof val === "object") {
                              return <pre className="text-[10px] font-mono text-zinc-600 p-1 bg-zinc-50 rounded border max-w-[200px] overflow-x-auto max-h-[80px]">{JSON.stringify(val, null, 2)}</pre>;
                            }
                            try {
                              const parsed = JSON.parse(val);
                              return <pre className="text-[10px] font-mono text-zinc-600 p-1 bg-zinc-50 rounded border max-w-[200px] overflow-x-auto max-h-[80px]">{JSON.stringify(parsed, null, 2)}</pre>;
                            } catch {
                              return <span className="font-mono text-[10px] text-zinc-550 break-all">{String(val)}</span>;
                            }
                          };

                          return (
                            <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-zinc-400"># {log.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-bold text-zinc-800 block">
                                  {new Date(log.created_at).toLocaleDateString()}
                                </span>
                                <span className="text-[10px] text-zinc-450 block mt-0.5">
                                  {new Date(log.created_at).toLocaleTimeString()}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold flex items-center justify-center font-mono select-none">
                                    {(log.username || "S").charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-zinc-900 block truncate">{log.username || "System"}</span>
                                    <span className="text-[10px] text-zinc-400 block font-mono">ID: {log.user_id || "System"}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-teal-50 text-teal-950 border-teal-200">
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-bold text-zinc-800 block uppercase font-mono text-[10px]">{log.entity_type}</span>
                                <span className="text-[10px] text-zinc-450 block font-mono mt-0.5">ID: {log.entity_id || "General"}</span>
                              </td>
                              <td className="px-6 py-4">{formatPayload(log.old_value)}</td>
                              <td className="px-6 py-4">{formatPayload(log.new_value)}</td>
                              <td className="px-6 py-4 font-mono text-zinc-450 text-[10px]">{log.ip_address || "127.0.0.1"}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Offline Data Stats */}
          {activeTab === "offline-data" && (
            <div className="space-y-8">
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 max-w-lg mx-auto text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">Offline Data Queue</h3>
                <p className="text-xs text-zinc-500 mb-8 leading-relaxed">
                  Currently tracking pending transactions made while disconnected from the server.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <p className="text-[10px] uppercase font-bold text-zinc-450 mb-1">Pending Records</p>
                    <p className="text-2xl font-black text-zinc-900">{queueStats.count}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <p className="text-[10px] uppercase font-bold text-zinc-450 mb-1">Estimated Size</p>
                    <p className="text-2xl font-black text-zinc-900">{queueStats.sizeKB} <span className="text-xs font-normal text-zinc-500">KB</span></p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 space-y-6">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-zinc-900">Enable Auto-Synchronization on Restore</span>
                    <input 
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-300 text-teal-700 focus:ring-teal-500"
                    />
                  </label>
                  
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-450 block mb-1.5 font-mono">Offline Queue Warning Threshold</label>
                    <input 
                       type="number"
                       value={offlineWarningThreshold}
                       onChange={(e) => setOfflineWarningThreshold(parseInt(e.target.value) || 0)}
                       className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                    />
                    <p className="text-[10px] text-zinc-450 mt-2 text-left">Warn admin when unsynchronized records exceed this limit.</p>
                    
                    <div className="pt-6 border-t border-zinc-100 mt-6">
                      <label className="text-[10px] uppercase font-bold text-zinc-450 block mb-3 font-mono">Background Auto-Retry Interval</label>
                      <select 
                        value={autoRetryInterval}
                        onChange={(e) => setAutoRetryInterval(parseInt(e.target.value))}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                      >
                        <option value="30000">Every 30 seconds</option>
                        <option value="60000">Every 1 minute</option>
                        <option value="300000">Every 5 minutes</option>
                        <option value="600000">Every 10 minutes</option>
                      </select>
                      <p className="text-[10px] text-zinc-450 mt-2 text-left">Automatically attempt to re-sync pending records in the background.</p>
                    </div>

                    <div className="pt-6 border-t border-zinc-100 mt-6">
                      <label className="text-[10px] uppercase font-bold text-zinc-450 block mb-3 font-mono">Default Resolution Strategy</label>
                      <select 
                        value={resolutionStrategy.default || "manual"}
                        onChange={(e) => setResolutionStrategy({ ...resolutionStrategy, default: e.target.value })}
                        className="w-full h-10 px-3.5 rounded-xl border border-zinc-250 bg-zinc-50 text-xs text-zinc-900 outline-none"
                      >
                        <option value="manual">Manual (Prompt at conflict)</option>
                        <option value="server">Keep Server</option>
                        <option value="local">Keep Local</option>
                      </select>
                      <p className="text-[10px] text-zinc-450 mt-2 text-left">Default action when a conflict occurs during sync.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conflict Viewer */}
              {conflicts.length > 0 && (
                <SyncConflicts conflicts={conflicts} onResolve={resolveConflict} />
              )}

              {/* Sync Latency Chart */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 mt-6">
                <h4 className="text-sm font-bold text-zinc-900 mb-6 font-mono uppercase tracking-wider">Historical Sync Latency (30 Days)</h4>
                <div className="relative h-64 w-full min-h-[256px] overflow-hidden">
                  {syncLogs.filter(log => log.latency).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2 border border-dashed border-zinc-100 rounded-2xl">
                      <Activity className="w-8 h-8 text-zinc-300" />
                      <p className="text-xs font-mono">No latency data available.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={syncLogs
                        .filter(log => new Date(log.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && log.latency)
                        .map(log => ({
                            timestamp: new Date(log.timestamp).toLocaleDateString(),
                            latency: log.latency
                        }))
                        .reverse()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis stroke="#a1a1aa" fontSize={10} tickFormatter={(value) => `${value}ms`} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', borderColor: '#e4e4e7', fontSize: '12px' }}
                        />
                        <Line type="monotone" dataKey="latency" stroke="#0f766e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Conflict Resolution Audit Log */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 mt-6">
                <h4 className="text-sm font-bold text-zinc-900 mb-6 font-mono uppercase tracking-wider">Conflict Resolution Audit Log</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-auto">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 text-[10px] uppercase font-bold">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Resolution Type</th>
                        <th className="p-3">Affected Record ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-xs">
                      {syncLogs
                        .filter(log => log.message.startsWith("Conflict resolved"))
                        .map((log: any, index: number) => {
                          const match = log.message.match(/Conflict resolved \((.*)\): (.*)/);
                          const resolutionType = match ? match[1] : "Unknown";
                          const recordPath = match ? match[2] : log.message;
                          const recordId = recordPath.split('/').pop();
                          
                          return (
                            <tr key={index}>
                              <td className="p-3 text-zinc-600">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="p-3 text-teal-800 font-bold">{resolutionType}</td>
                              <td className="p-3 font-mono text-zinc-800">{recordId}</td>
                            </tr>
                          );
                        })}
                      {syncLogs.filter(log => log.message.startsWith("Conflict resolved")).length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-zinc-400 text-xs">No resolved conflicts logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Log Viewer */}
              <div className="bg-white rounded-3xl border border-zinc-200 p-8">
                <h4 className="text-sm font-bold text-zinc-900 mb-6 font-mono uppercase tracking-wider">Synchronization History</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-auto">
                        <thead>
                           <tr className="border-b border-zinc-200 text-zinc-500 text-[10px] uppercase font-bold">
                               <th className="p-3">Timestamp</th>
                               <th className="p-3">Status</th>
                               <th className="p-3">Message</th>
                           </tr>
                        </thead>
                        <tbody>
                          {syncLogs.length === 0 ? (
                            <tr><td colSpan={3} className="p-6 text-center text-xs text-zinc-400">No sync attempts logged.</td></tr>
                          ) : (
                            syncLogs.map((log: any, i: number) => (
                              <tr key={i} className="border-b border-zinc-100 text-xs hover:bg-zinc-50">
                                <td className="p-3 font-mono text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-zinc-700 truncate max-w-sm">{log.message}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Secure Database Backup */}
          {activeTab === "backup" && (
            <div className="space-y-8 max-w-3xl mx-auto">
              <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileDown className="w-8 h-8 text-teal-700" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">Secure Database ZIP Backup</h3>
                <p className="text-xs text-zinc-500 max-w-lg mx-auto mb-8 leading-relaxed">
                  Generate and download a comprehensive, encrypted ZIP archive containing all system tables exported as standard CSV sheets and a full JSON state dump.
                </p>

                <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-150 text-left mb-8 space-y-4">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider font-mono">Compliant Security Manifest</h4>
                  <ul className="text-xs text-zinc-650 space-y-2.5 list-inside">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        <span className="font-bold text-zinc-950">PII Field-Level Encryption:</span> All sensitive columns (Names, Emails, Phone Numbers, Employee Identifiers, QR signatures, and Passwords) are fully encrypted at rest inside the CSV and JSON files using high-grade deterministic <span className="font-mono bg-zinc-200 px-1 py-0.5 rounded text-[11px]">AES-256-GCM</span> cryptography.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        <span className="font-bold text-zinc-950">Structural Separation:</span> The ZIP file packages separate relational tables into independent CSV sheets for standard database reporting and audit analysis.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        <span className="font-bold text-zinc-950">Complete State Mapping:</span> Includes a master JSON document (<span className="font-mono bg-zinc-200 px-1 py-0.5 rounded text-[11px]">database_raw_dump.json</span>) representing the complete database state for recovery backups.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-700 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        <span className="font-bold text-zinc-950">Security Audit Trail:</span> Every ZIP generation request is cryptographically stamped and committed to the system's un-alterable Audit Logs ledger for complete accountability.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-zinc-100 pt-6">
                  <button
                    type="button"
                    disabled={generatingBackup}
                    onClick={handleDownloadBackup}
                    className={`h-11 px-8 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                      generatingBackup
                        ? "bg-zinc-100 border border-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-teal-700 text-white hover:bg-teal-850 shadow-sm"
                    }`}
                  >
                    {generatingBackup ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating Cryptographic Package...
                      </>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4" />
                        Download Encrypted ZIP Backup
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(true)}
                    className="h-11 px-6 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-650 hover:bg-zinc-50 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-teal-700" />
                    Database Recovery Guide
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Database Diagnostics */}
          {activeTab === "diagnostics" && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {loadingDiagnostics && !diagnostics ? (
                <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-sm flex flex-col items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-teal-700 animate-spin mb-4" />
                  <p className="text-xs text-zinc-500 font-medium">Compiling dynamic database telemetry and checking table counts...</p>
                </div>
              ) : diagnosticsError ? (
                <div className="bg-white rounded-3xl border border-zinc-200 p-8 text-center shadow-sm">
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
                  <h3 className="text-sm font-bold text-zinc-900 mb-1">Failed to Load Diagnostics</h3>
                  <p className="text-xs text-rose-600 mb-6">{diagnosticsError}</p>
                  <button
                    onClick={fetchDiagnostics}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              ) : diagnostics ? (
                <div className="space-y-6 animate-fade-in">
                  {/* Summary Status Section */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* DB Connection Status */}
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Engine Status</span>
                        <div className="p-2 bg-teal-50 rounded-xl">
                          <Database className="w-5 h-5 text-teal-700" />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1 font-bold">Database Connection</span>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${diagnostics.databaseConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                          <span className="text-sm font-black text-zinc-900">
                            {diagnostics.databaseConnected ? "Online & Connected" : "Local HA Fallback"}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono mt-1 block leading-relaxed">
                          {diagnostics.databaseType}
                        </span>
                      </div>
                    </div>

                    {/* Stability State */}
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Stability Rating</span>
                        <div className={`p-2 rounded-xl ${
                          diagnostics.healthStatus === "Excellent" ? "bg-emerald-50 text-emerald-700" :
                          diagnostics.healthStatus === "Warning" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          <Server className="w-5 h-5" />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1 font-bold">System Stability</span>
                        <div className="flex items-center gap-1.5">
                          {diagnostics.healthStatus === "Excellent" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : diagnostics.healthStatus === "Warning" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className={`text-sm font-black ${
                            diagnostics.healthStatus === "Excellent" ? "text-emerald-700" :
                            diagnostics.healthStatus === "Warning" ? "text-amber-700" : "text-rose-700"
                          }`}>
                            {diagnostics.healthStatus} Status
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono mt-1 block leading-relaxed">
                          Checks latency profiles, server heap allocations, and active sockets.
                        </span>
                      </div>
                    </div>

                    {/* Error Rate Indicator */}
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">Recent Telemetry</span>
                        <div className="p-2 bg-zinc-50 rounded-xl">
                          <TrendingUp className="w-5 h-5 text-zinc-600" />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1 font-bold">Error Rate (Last 100 API Calls)</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-2xl font-black ${
                            diagnostics.recentErrorRates.recentErrorRate > 15 ? "text-rose-600" : "text-teal-900"
                          }`}>
                            {diagnostics.recentErrorRates.recentErrorRate}%
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ({diagnostics.recentErrorRates.recentErrors} errors out of {diagnostics.recentErrorRates.recentRequests} requests)
                          </span>
                        </div>
                        {/* Small micro progress bar */}
                        <div className="w-full bg-zinc-100 h-1 rounded-full mt-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              diagnostics.recentErrorRates.recentErrorRate > 15 ? "bg-rose-500" : "bg-teal-700"
                            }`}
                            style={{ width: `${Math.min(100, diagnostics.recentErrorRates.recentErrorRate)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Two Column Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Table Counts Panel - takes 3 columns */}
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm lg:col-span-3 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <div>
                          <h4 className="text-sm font-black text-zinc-900">Table Record Counts</h4>
                          <p className="text-[11px] text-zinc-400">Total volume representation across relational schemas</p>
                        </div>
                        <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded-full text-[10px] font-mono font-bold text-zinc-600">
                          {(Object.values(diagnostics.tableCounts) as number[]).reduce((a: number, b: number) => a + b, 0)} Total Records
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-100 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                              <th className="pb-2">Table Name</th>
                              <th className="pb-2 text-right">Record Count</th>
                              <th className="pb-2 text-right">Capacity Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {Object.entries(diagnostics.tableCounts).map(([table, count]: any) => {
                              const friendlyName = table.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                              let capacityColor = "text-teal-700 bg-teal-50 border-teal-150";
                              let capacityLabel = "Healthy";
                              
                              if (count > 5000) {
                                capacityColor = "text-amber-700 bg-amber-50 border-amber-150";
                                capacityLabel = "Optimizing";
                              }
                              if (count > 25000) {
                                capacityColor = "text-rose-700 bg-rose-50 border-rose-150";
                                capacityLabel = "Archiving Needed";
                              }

                              return (
                                <tr key={table} className="hover:bg-zinc-50/50 transition-colors">
                                  <td className="py-2.5 font-bold text-zinc-800 font-sans">
                                    {friendlyName}
                                    <span className="block text-[9px] text-zinc-400 font-mono font-normal">table: {table}</span>
                                  </td>
                                  <td className="py-2.5 text-right font-mono font-bold text-zinc-900">
                                    {Number(count).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${capacityColor}`}>
                                      {capacityLabel}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Endpoint Error Rates & Performance - takes 2 columns */}
                    <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm lg:col-span-2 space-y-4">
                      <div className="border-b border-zinc-100 pb-3">
                        <h4 className="text-sm font-black text-zinc-900">Endpoint Reliability</h4>
                        <p className="text-[11px] text-zinc-400">Error profile for the highest frequency paths</p>
                      </div>

                      <div className="space-y-3.5">
                        {diagnostics.recentErrorRates.endpointBreakdown.length === 0 ? (
                          <div className="text-center py-8 text-zinc-400 text-xs font-medium">
                            No telemetry available. Trigger some user actions to compile stats.
                          </div>
                        ) : (
                          diagnostics.recentErrorRates.endpointBreakdown.map((item: any) => {
                            const isHighError = item.errorRate > 20;
                            return (
                              <div key={item.endpoint} className="flex flex-col gap-1 pb-3 border-b border-zinc-50 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] text-zinc-700 font-bold truncate max-w-44 animate-none" title={item.endpoint}>
                                    {item.endpoint}
                                  </span>
                                  <span className={`font-mono text-[11px] font-bold ${isHighError ? "text-rose-600" : "text-zinc-500"}`}>
                                    {item.errorRate}% err
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                  <span>{item.count} total requests logged</span>
                                  <span className={isHighError ? "text-rose-500 font-bold animate-pulse" : "text-teal-600 font-bold"}>
                                    {isHighError ? "Unstable Path" : "Highly Stable"}
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden mt-1">
                                  <div
                                    className={`h-full rounded-full ${isHighError ? "bg-rose-500 animate-pulse" : "bg-teal-600"}`}
                                    style={{ width: `${Math.min(100, item.count * 10)}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* System Environment Strip */}
                  <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-150 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-650 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-800 font-mono">Server Uptime:</span>
                      <span className="font-mono bg-zinc-200 px-2 py-0.5 rounded font-bold text-zinc-700">
                        {Math.floor(diagnostics.systemStats.uptime / 3600)}h {Math.floor((diagnostics.systemStats.uptime % 3600) / 60)}m {Math.floor(diagnostics.systemStats.uptime % 60)}s
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-800 font-mono">Heap Used:</span>
                        <span className="font-mono text-zinc-600">{diagnostics.systemStats.memoryHeapUsed} MB</span>
                      </div>
                      <div className="w-px h-3 bg-zinc-300"></div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-800 font-mono">Heap Max Limit:</span>
                        <span className="font-mono text-zinc-600">{diagnostics.systemStats.memoryHeapTotal} MB</span>
                      </div>
                    </div>

                    <button
                      onClick={fetchDiagnostics}
                      disabled={loadingDiagnostics}
                      className="text-[11px] text-teal-700 hover:text-teal-900 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingDiagnostics ? "animate-spin" : ""}`} />
                      Refresh Data
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Database Recovery Guide Modal */}
          {showRecoveryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 flex flex-col space-y-6">
                <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-700">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-zinc-900">Database Recovery Protocol</h3>
                      <p className="text-xs text-zinc-500">Restore your system using sqlite3 CLI utility and ZIP backups</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRecoveryModal(false)}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5 text-xs text-zinc-600 leading-relaxed">
                  <p>
                    Follow these step-by-step instructions to recreate or import your high-availability fallback database schema from the downloaded encrypted ZIP backup using the standard <code className="font-mono bg-zinc-150 px-1 py-0.5 rounded text-[11px] text-zinc-800">sqlite3</code> command-line interface.
                  </p>

                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-850 font-black flex items-center justify-center font-mono text-[10px] shrink-0">1</span>
                      <div className="w-full">
                        <h4 className="font-bold text-zinc-900">Extract the Archive</h4>
                        <p className="text-zinc-500">Unzip the generated package to access individual tables in CSV format and the full JSON state dump.</p>
                        <div className="relative mt-2 font-mono bg-zinc-900 text-zinc-200 p-3 rounded-xl border border-zinc-800 text-[11px] flex items-center justify-between">
                          <span>unzip dgmc_encrypted_backup_*.zip -d dgmc_backup</span>
                          <button
                            onClick={() => handleCopySnippet("unzip", "unzip dgmc_encrypted_backup_*.zip -d dgmc_backup")}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy to Clipboard"
                          >
                            {copiedSnippetId === "unzip" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-850 font-black flex items-center justify-center font-mono text-[10px] shrink-0">2</span>
                      <div className="w-full">
                        <h4 className="font-bold text-zinc-900">Initialize standard sqlite3 database</h4>
                        <p className="text-zinc-500">Create a new local SQLite database file on your local server environment.</p>
                        <div className="relative mt-2 font-mono bg-zinc-900 text-zinc-200 p-3 rounded-xl border border-zinc-800 text-[11px] flex items-center justify-between">
                          <span>sqlite3 dgmc_restored.db</span>
                          <button
                            onClick={() => handleCopySnippet("sqlite", "sqlite3 dgmc_restored.db")}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy to Clipboard"
                          >
                            {copiedSnippetId === "sqlite" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-850 font-black flex items-center justify-center font-mono text-[10px] shrink-0">3</span>
                      <div className="w-full">
                        <h4 className="font-bold text-zinc-900">Import CSV Sheets into Relational Tables</h4>
                        <p className="text-zinc-500">Inside the sqlite3 interactive prompt, switch input parsing to CSV mode and run standard imports.</p>
                        
                        <div className="relative mt-2 bg-zinc-900 text-zinc-200 p-4 rounded-2xl border border-zinc-800 text-[11px] font-mono leading-relaxed group">
                          <button
                            onClick={() => handleCopySnippet("import-cmds", `.mode csv\n.import dgmc_backup/departments.csv departments\n.import dgmc_backup/people.csv people\n.import dgmc_backup/employee_schedules.csv employee_schedules\n.import dgmc_backup/transactions.csv transactions\n.import dgmc_backup/free_meal_logs.csv free_meal_logs\n.import dgmc_backup/system_settings.csv system_settings\n.import dgmc_backup/audit_logs.csv audit_logs\n.import dgmc_backup/login_attempts.csv login_attempts`)}
                            className="absolute top-3 right-3 p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-all border border-zinc-750 cursor-pointer"
                            title="Copy all commands"
                          >
                            {copiedSnippetId === "import-cmds" ? (
                              <span className="text-[10px] text-emerald-400 font-sans font-bold flex items-center gap-1 px-1">
                                <Check className="w-3 h-3" /> Copied
                              </span>
                            ) : (
                              <span className="text-[10px] font-sans flex items-center gap-1 px-1">
                                <Copy className="w-3 h-3" /> Copy Snippet
                              </span>
                            )}
                          </button>
                          <div className="space-y-0.5">
                            <div className="text-zinc-500">-- Set prompt mode to CSV parsing</div>
                            <div className="text-teal-400">.mode csv</div>
                            <div className="text-zinc-500 mt-2">-- Import separate database schemas</div>
                            <div>.import dgmc_backup/departments.csv departments</div>
                            <div>.import dgmc_backup/people.csv people</div>
                            <div>.import dgmc_backup/employee_schedules.csv employee_schedules</div>
                            <div>.import dgmc_backup/transactions.csv transactions</div>
                            <div>.import dgmc_backup/free_meal_logs.csv free_meal_logs</div>
                            <div>.import dgmc_backup/system_settings.csv system_settings</div>
                            <div>.import dgmc_backup/audit_logs.csv audit_logs</div>
                            <div>.import dgmc_backup/login_attempts.csv login_attempts</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 text-amber-900 flex gap-3.5 items-start mt-4">
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[13px] mb-1 text-amber-950">PII Encryption Verification Notice</h4>
                      <p className="text-[11px] text-amber-850 leading-relaxed">
                        Notice that personal details inside the <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded text-[10px]">people</code> dataset remain fully AES-256-GCM encrypted in the CSV files. Once imported, the main application's decryption service will automatically and dynamically decrypt them when matching credentials or rendering dashboard interfaces.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-5 flex items-center justify-end">
                  <button
                    onClick={() => setShowRecoveryModal(false)}
                    className="h-10 px-5 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    Close Protocol Guide
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: RBAC Visualizer */}
          {activeTab === "rbac" && (
            <RBACVisualizer />
          )}
        </>
      )}
    </div>
  );
}
