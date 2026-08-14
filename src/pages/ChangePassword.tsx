import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import PageHeader from "../components/PageHeader.js";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../constants/security.js";
import { validatePasswordComplexity } from "../utils/password.js";

export default function ChangePassword() {
  const { apiFetch } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [minPasswordLength, setMinPasswordLength] = useState(MIN_PASSWORD_LENGTH);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/settings")
      .then((settings) => {
        if (Array.isArray(settings)) {
          const item = settings.find((s: any) => s.setting_key === "min_password_length");
          if (item && item.setting_value) {
            const val = parseInt(item.setting_value, 10);
            if (!isNaN(val) && val > 0) setMinPasswordLength(val);
          }
        }
      })
      .catch(() => {});
  }, [apiFetch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validatePasswordComplexity(newPassword, minPasswordLength);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Confirmation password matches do not align.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess(data.message || "Password successfully changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="change-pass-page">
      <PageHeader
        title="Security & Credentials"
        subtitle="Manage your medical center personnel password authentication"
      />

      <div className="max-w-md bg-white rounded-2xl border border-zinc-200 shadow-xs p-6 md:p-8">
        <h2 className="text-md font-bold text-zinc-900 border-b border-zinc-100 pb-3 mb-6">Change Terminal Password</h2>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-600 block mb-1.5 font-mono uppercase tracking-wider">
              Current password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-10 px-3.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white text-zinc-900"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-600 block mb-1.5 font-mono uppercase tracking-wider">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Min ${minPasswordLength} chars, numbers, symbols, mixed case`}
              className="w-full h-10 px-3.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white text-zinc-900"
            />
            <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider block mb-1">Complexity Requirements</span>
              <ul className="text-[11px] text-zinc-600 space-y-1 list-disc list-inside">
                <li className={newPassword.length >= minPasswordLength ? "text-emerald-600 font-bold" : "text-zinc-500"}>Minimum {minPasswordLength} characters</li>
                <li className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? "text-emerald-600 font-bold" : "text-zinc-500"}>Mixed case (both lower & upper letters)</li>
                <li className={/[0-9]/.test(newPassword) ? "text-emerald-600 font-bold" : "text-zinc-500"}>At least one number</li>
                <li className={/[^a-zA-Z0-9]/.test(newPassword) ? "text-emerald-600 font-bold" : "text-zinc-500"}>At least one symbol or special character</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-600 block mb-1.5 font-mono uppercase tracking-wider">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full h-10 px-3.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white text-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-teal-800 hover:bg-teal-900 disabled:bg-teal-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider mt-4 flex items-center justify-center gap-2.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Commit Security Update
          </button>
        </form>
      </div>
    </div>
  );
}
