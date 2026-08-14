import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";

interface SecureFieldProps {
  value?: string | null;
  fallback?: string;
  className?: string;
  isSensitiveOnly?: boolean; // if true, masks even if plain-text until clicked (shoulder-surfing prevention)
}

export const SecureField: React.FC<SecureFieldProps> = ({
  value,
  fallback = "N/A",
  className = "",
  isSensitiveOnly = false
}) => {
  const { apiFetch, user } = useAuth();
  const [isRevealed, setIsRevealed] = useState(false);
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!value) {
    return <span className="text-zinc-400 font-medium">{fallback}</span>;
  }

  const isEncrypted = value.startsWith("enc:") || value.startsWith("enc_det:");
  const canDecrypt = user?.role === "admin" || user?.role === "manager";

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (!isEncrypted) {
      setIsRevealed(true);
      return;
    }

    if (decryptedValue) {
      setIsRevealed(true);
      return;
    }

    if (!canDecrypt) {
      setError("Unprivileged");
      setTimeout(() => setError(null), 2500);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/decrypt-field", {
        method: "POST",
        body: JSON.stringify({ ciphertext: value }),
      });
      if (data && typeof data.decrypted === "string") {
        setDecryptedValue(data.decrypted);
        setIsRevealed(true);
      } else {
        throw new Error("Invalid response");
      }
    } catch (_err: any) {
      setError("Failed");
      setTimeout(() => setError(null), 2500);
    } finally {
      setLoading(false);
    }
  };

  const getMaskedDisplay = () => {
    if (isEncrypted) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono tracking-widest text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 select-none">
          <Lock className="w-2.5 h-2.5 text-zinc-500 mr-0.5 shrink-0" />
          ••••••••
        </span>
      );
    }
    if (isSensitiveOnly) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono tracking-widest text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 select-none">
          ••••••••
        </span>
      );
    }
    return <span className="font-mono text-zinc-700">{value}</span>;
  };

  return (
    <div className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      {isRevealed ? (
        <span className="font-mono font-bold text-zinc-900 bg-teal-50/50 text-teal-900 border border-teal-150 px-2 py-0.5 rounded select-all transition-all">
          {isEncrypted ? decryptedValue : value}
        </span>
      ) : (
        getMaskedDisplay()
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`p-1 rounded-md transition-all shrink-0 ${
          isRevealed
            ? "hover:bg-zinc-100 text-teal-800 hover:text-teal-900"
            : error
            ? "bg-rose-50 border border-rose-200 text-rose-600 animate-pulse"
            : isEncrypted
            ? "hover:bg-teal-50 text-zinc-400 hover:text-teal-700 hover:border hover:border-teal-200"
            : "hover:bg-zinc-100 text-zinc-400 hover:text-zinc-650"
        }`}
        title={
          error
            ? error === "Unprivileged"
              ? "Access Denied: Admin or Manager only"
              : "Decryption failed"
            : isRevealed
            ? "Mask field"
            : "Decrypt on-demand"
        }
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
        ) : error ? (
          <span className="text-[9px] font-extrabold px-1 uppercase font-sans">
            {error === "Unprivileged" ? "Auth Err" : "Err"}
          </span>
        ) : isRevealed ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
};
