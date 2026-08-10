import React, { useRef, useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { 
  QrCode, 
  Printer, 
  ShieldCheck, 
  Download, 
  Upload, 
  User, 
  Grid, 
  Settings, 
  Palette, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  RefreshCw,
  BadgeAlert,
  Info,
  Maximize2
} from "lucide-react";
import DGMCLogo from "../../components/DGMCLogo.js";
import QRCode from "qrcode";
import { motion } from "motion/react";

interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  dark: string;
  bannerBg: string;
  lightBg: string;
  textColor: string;
  accentColor: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "sapphire",
    name: "Deep Sapphire (Standard)",
    primary: "#003299",
    secondary: "#3b82f6",
    dark: "#172554",
    bannerBg: "bg-blue-950",
    lightBg: "bg-blue-50/40",
    textColor: "text-[#003299]",
    accentColor: "#3b82f6"
  },
  {
    id: "emerald",
    name: "Clinical Emerald",
    primary: "#0d9488",
    secondary: "#059669",
    dark: "#115e59",
    bannerBg: "bg-teal-950",
    lightBg: "bg-teal-50/40",
    textColor: "text-teal-800",
    accentColor: "#059669"
  },
  {
    id: "ruby",
    name: "Critical Ruby (ER)",
    primary: "#be123c",
    secondary: "#f43f5e",
    dark: "#4c0519",
    bannerBg: "bg-rose-950",
    lightBg: "bg-rose-50/40",
    textColor: "text-rose-800",
    accentColor: "#f43f5e"
  },
  {
    id: "slate",
    name: "Slate Minimalist",
    primary: "#1f2937",
    secondary: "#4b5563",
    dark: "#030712",
    bannerBg: "bg-zinc-900",
    lightBg: "bg-zinc-50/50",
    textColor: "text-zinc-800",
    accentColor: "#4b5563"
  },
  {
    id: "cosmic",
    name: "Cosmic Gold (Dark)",
    primary: "#111827",
    secondary: "#d97706",
    dark: "#090d16",
    bannerBg: "bg-zinc-950",
    lightBg: "bg-zinc-900/40",
    textColor: "text-amber-500",
    accentColor: "#d97706"
  }
];

export default function EmployeeQR() {
  const { user, branding, apiFetch } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Customizer state
  const [passMode, setPassMode] = useState<"badge" | "standalone">("badge");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset>(THEME_PRESETS[0]);
  const [avatarType, setAvatarType] = useState<"uploaded" | "physician_m" | "physician_f" | "nurse" | "admin">("physician_m");
  const [uploadedPhoto, setUploadedPhoto] = useState<string>("");
  
  // Customizer layout options
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);
  const [showDepartment, setShowDepartment] = useState<boolean>(true);
  const [showPosition, setShowPosition] = useState<boolean>(true);
  const [showHireDate, setShowHireDate] = useState<boolean>(true);
  const [showGuideLines, setShowGuideLines] = useState<boolean>(true);
  const [badgeHolderFrame, setBadgeHolderFrame] = useState<boolean>(true);

  // High-Security Cryptographic rotating OTP settings
  const [useSecureCrypto, setUseSecureCrypto] = useState<boolean>(true);
  const [securePayload, setSecurePayload] = useState<string>("");
  const [secureExpiresIn, setSecureExpiresIn] = useState<number>(0);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isGeneratingPng, setIsGeneratingPng] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"layout" | "appearance" | "help">("layout");

  // Batch Export state for Admin/Manager
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchEmployees, setBatchEmployees] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const handleFetchBatchExport = async () => {
    setBatchLoading(true);
    try {
      const res = await apiFetch("/api/admin/batch-qr-export");
      if (Array.isArray(res)) {
        setBatchEmployees(res);
        setShowBatchModal(true);
      }
    } catch (e) {
      console.error("Failed to load batch employees for QR export", e);
    } finally {
      setBatchLoading(false);
    }
  };

  // Load avatar if cached
  useEffect(() => {
    if (user) {
      const cached = localStorage.getItem(`dgmc_avatar_${user.id}`);
      if (cached) {
        setUploadedPhoto(cached);
        setAvatarType("uploaded");
      }
    }
  }, [user]);

  // Load dynamic cryptographically signed rotating QR code
  useEffect(() => {
    if (!user || !useSecureCrypto) {
      setSecurePayload("");
      return;
    }

    let active = true;
    let timerId: any = null;

    const fetchSignedPayload = async () => {
      try {
        const data = await apiFetch("/api/employee/qr-signed");
        if (active && data?.qr_payload) {
          setSecurePayload(data.qr_payload);
          setSecureExpiresIn(data.expiresIn || 60);
        }
      } catch (err) {
        console.error("Error fetching cryptographic QR signature:", err);
      }
    };

    fetchSignedPayload();

    // Refresh signature every 45 seconds to keep it fresh and prevent replay attacks
    const refreshInterval = setInterval(() => {
      fetchSignedPayload();
    }, 45000);

    // Countdown tick
    timerId = setInterval(() => {
      setSecureExpiresIn(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
      clearInterval(timerId);
    };
  }, [user, useSecureCrypto]);

  // Generate QR Code data URL dynamically
  useEffect(() => {
    if (!user) return;
    const code = (useSecureCrypto && securePayload) 
      ? securePayload 
      : (user.qr_code || user.employee_no || "EMP-001");

    QRCode.toDataURL(
      code,
      {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 300,
        color: {
          dark: selectedTheme.id === "cosmic" ? "#000000" : selectedTheme.primary,
          light: "#ffffff",
        },
      },
      (err, url) => {
        if (err) {
          console.error("QR Code generation error", err);
          return;
        }
        setQrDataUrl(url);
      }
    );
  }, [user, selectedTheme, useSecureCrypto, securePayload]);

  if (!user) return null;

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedPhoto(result);
      setAvatarType("uploaded");
      localStorage.setItem(`dgmc_avatar_${user.id}`, result);
    };
    reader.readAsDataURL(file);
  };

  // Reset uploaded photo
  const handleResetPhoto = () => {
    setUploadedPhoto("");
    setAvatarType("physician_m");
    localStorage.removeItem(`dgmc_avatar_${user.id}`);
  };

  // Trigger browser printing
  const handlePrint = () => {
    window.print();
  };

  // Render static vector avatar shapes or photos
  const renderAvatarContent = () => {
    if (avatarType === "uploaded" && uploadedPhoto) {
      return (
        <img 
          src={uploadedPhoto} 
          alt="Uploaded Profile" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      );
    }

    // High quality clinical symbols
    switch (avatarType) {
      case "physician_m":
        return (
          <div className="w-full h-full bg-blue-50 text-blue-600 flex items-center justify-center flex-col">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-1/2 h-1/2 stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />
            </svg>
            <span className="text-[7px] font-mono font-bold tracking-wider mt-1 uppercase text-blue-700">M-MD</span>
          </div>
        );
      case "physician_f":
        return (
          <div className="w-full h-full bg-rose-50 text-rose-600 flex items-center justify-center flex-col">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-1/2 h-1/2 stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />
            </svg>
            <span className="text-[7px] font-mono font-bold tracking-wider mt-1 uppercase text-rose-700">F-MD</span>
          </div>
        );
      case "nurse":
        return (
          <div className="w-full h-full bg-teal-50 text-teal-600 flex items-center justify-center flex-col">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-1/2 h-1/2 stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
            <span className="text-[7px] font-mono font-bold tracking-wider mt-1 uppercase text-teal-700">RN</span>
          </div>
        );
      case "admin":
      default:
        return (
          <div className="w-full h-full bg-zinc-100 text-zinc-600 flex items-center justify-center flex-col">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-1/2 h-1/2 stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="text-[7px] font-mono font-bold tracking-wider mt-1 uppercase text-zinc-700">STAFF</span>
          </div>
        );
    }
  };

  // Generate and Download high-DPI custom card layout
  const handleDownloadPng = async () => {
    setIsGeneratingPng(true);
    try {
      // Define canvas bounds based on CR80 Aspect Ratio (1.586) at high DPI (approx 300 DPI)
      const isPortrait = orientation === "portrait";
      const width = isPortrait ? 638 : 1012;
      const height = isPortrait ? 1012 : 638;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Enable maximum image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // 1. Draw Primary Background Fill
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle decorative grids / textures
      ctx.strokeStyle = "rgba(0,0,0,0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (passMode === "standalone") {
        if (isPortrait) {
          // --- PORTRAIT STANDALONE QR PASS DRAWING ---
          const cx = width / 2;
          
          // Outer Border with custom double line styling for clinical premium feel
          ctx.strokeStyle = selectedTheme.primary;
          ctx.lineWidth = 14;
          ctx.strokeRect(7, 7, width - 14, height - 14);
          
          ctx.strokeStyle = selectedTheme.accentColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(18, 18, width - 36, height - 36);
          
          // Hospital Branding Header
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(branding.companyName.toUpperCase(), cx, 100);
          
          ctx.fillStyle = "#64748b";
          ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
          ctx.fillText("AUTHORIZED DIETARY ACCESS QR TOKEN", cx, 130);
          
          // Decorative line
          ctx.fillStyle = selectedTheme.accentColor;
          ctx.fillRect(80, 155, width - 160, 4);
          
          // Big QR code image
          if (qrDataUrl) {
            const qrImg = new Image();
            const qrSize = 360;
            const qx = cx - qrSize / 2;
            const qy = 210;
            
            // Draw card background for QR
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 15;
            ctx.fillRect(qx - 20, qy - 20, qrSize + 40, qrSize + 40);
            ctx.shadowBlur = 0;
            
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 2;
            ctx.strokeRect(qx - 20, qy - 20, qrSize + 40, qrSize + 40);
            
            await new Promise<void>((resolve) => {
              qrImg.onload = () => {
                ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
                resolve();
              };
              qrImg.src = qrDataUrl;
            });
          }
          
          // Employee Name
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${user.first_name} ${user.last_name}`, cx, 680);
          
          // Job Position
          if (showPosition) {
            ctx.fillStyle = "#475569";
            ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
            ctx.fillText((user.position || "Hospital Personnel").toUpperCase(), cx, 715);
          }
          
          // Employee ID Details
          const blockY = 760;
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(80, blockY, width - 160, 80);
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.strokeRect(80, blockY, width - 160, 80);
          
          ctx.fillStyle = "#94a3b8";
          ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("EMPLOYEE IDENTIFICATION NUMBER", cx, blockY + 28);
          ctx.fillStyle = selectedTheme.dark;
          ctx.font = "bold 22px monospace";
          ctx.fillText(user.employee_no || "N/A", cx, blockY + 58);
          
          // Footer
          if (showDisclaimer) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "normal 11px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`PROPERTY OF ${branding.companyName.toUpperCase()} • SECURITY SYSTEM GATEWAY CLAIMS`, cx, 915);
            ctx.fillText("PRESENT AT TERMINAL FOR DIETARY BENEFIT REDEMPTION", cx, 935);
          }
        } else {
          // --- LANDSCAPE STANDALONE QR PASS DRAWING ---
          const lcx = width / 2;
          
          // Outer Border with premium design
          ctx.strokeStyle = selectedTheme.primary;
          ctx.lineWidth = 14;
          ctx.strokeRect(7, 7, width - 14, height - 14);
          
          ctx.strokeStyle = selectedTheme.accentColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(18, 18, width - 36, height - 36);
          
          // Draw split layout
          // Left: QR Code
          if (qrDataUrl) {
            const qrImg = new Image();
            const qrSize = 340;
            const qx = 75;
            const qy = 150;
            
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 15;
            ctx.fillRect(qx - 15, qy - 15, qrSize + 30, qrSize + 30);
            ctx.shadowBlur = 0;
            
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 2;
            ctx.strokeRect(qx - 15, qy - 15, qrSize + 30, qrSize + 30);
            
            await new Promise<void>((resolve) => {
              qrImg.onload = () => {
                ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
                resolve();
              };
              qrImg.src = qrDataUrl;
            });
            
            // Subtext under QR code
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 13px monospace";
            ctx.textAlign = "center";
            ctx.fillText(`TOKEN: ${user.qr_code || "N/A"}`, qx + qrSize / 2, qy + qrSize + 35);
          }
          
          // Right: Branding, Name, ID, Instructions
          const rx = 490;
          
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(branding.companyName.toUpperCase(), rx, 110);
          
          ctx.fillStyle = selectedTheme.accentColor;
          ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
          ctx.fillText("AUTHORIZED DIETARY ACCESS QR TOKEN", rx, 140);
          
          // Divider
          ctx.fillStyle = "#cbd5e1";
          ctx.fillRect(rx, 165, 430, 2);
          
          // Name
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
          ctx.fillText(`${user.first_name} ${user.last_name}`, rx, 225);
          
          if (showPosition) {
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
            ctx.fillText((user.position || "Hospital Personnel").toUpperCase(), rx, 255);
          }
          
          // ID number block
          const blockY = 285;
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(rx, blockY, 430, 75);
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, blockY, 430, 75);
          
          ctx.fillStyle = "#94a3b8";
          ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
          ctx.fillText("EMPLOYEE IDENTIFICATION NUMBER", rx + 20, blockY + 28);
          ctx.fillStyle = selectedTheme.dark;
          ctx.font = "bold 20px monospace";
          ctx.fillText(user.employee_no || "N/A", rx + 20, blockY + 54);
          
          // Instructions
          ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
          ctx.fillRect(rx, 380, 430, 85);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
          ctx.strokeRect(rx, 380, 430, 85);
          
          ctx.fillStyle = "#059669";
          ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
          ctx.fillText("✓ VERIFIED EMERGENCY CLAIM CREDENTIALS", rx + 15, 405);
          ctx.fillStyle = "#475569";
          ctx.font = "normal 11px system-ui, -apple-system, sans-serif";
          ctx.fillText("Present code to scanner terminal to verify daily meal credits.", rx + 15, 428);
          ctx.fillText("Valid only for active shift roster matching authorized credentials.", rx + 15, 448);
          
          if (showDisclaimer) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "normal 10px system-ui, -apple-system, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`PROPERTY OF ${branding.companyName.toUpperCase()} • ALL RIGHTS RESERVED`, rx, 510);
          }
        }
      } else {
        if (isPortrait) {
          // --- PORTRAIT BADGE GRAPHICS DRAWING ---
          // Top Banner block
          ctx.fillStyle = selectedTheme.id === "cosmic" ? "#090d16" : selectedTheme.primary;
          ctx.fillRect(0, 0, width, 240);

          // Top decorative gold line for Cosmic, otherwise accent
          ctx.fillStyle = selectedTheme.accentColor;
          ctx.fillRect(0, 235, width, 5);

          // Hospital Cross Badge Symbol in Header
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          // Cross drawing
          const cx = width / 2;
          const cy = 80;
          ctx.fillRect(cx - 10, cy - 30, 20, 60);
          ctx.fillRect(cx - 30, cy - 10, 60, 20);

          // Header Title Texts
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 24px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(branding.companyName.toUpperCase(), cx, 155);

          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.font = "normal 14px system-ui, sans-serif";
          ctx.fillText("DIETARY MANAGEMENT PASS", cx, 185);

          // Roster Details Frame (White card below header)
          // Draw avatar slot
          const avatarSize = 150;
          const ax = cx - avatarSize / 2;
          const ay = 280;

          // Clip rounded path for Avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();

          // Render photo onto Canvas
          if (avatarType === "uploaded" && uploadedPhoto) {
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                ctx.drawImage(img, ax, ay, avatarSize, avatarSize);
                resolve();
              };
              img.src = uploadedPhoto;
            });
          } else {
            // Draw generic vector profile circle
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(ax, ay, avatarSize, avatarSize);
            ctx.fillStyle = selectedTheme.primary;
            ctx.beginPath();
            ctx.arc(cx, ay + avatarSize * 1.2, avatarSize * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(cx, ay + avatarSize / 2, avatarSize * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Draw Avatar ring border
          ctx.strokeStyle = selectedTheme.accentColor;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.stroke();

          // Employee Name
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 34px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${user.first_name} ${user.last_name}`, cx, 495);

          // Position / Role
          if (showPosition) {
            ctx.fillStyle = "#64748b";
            ctx.font = "bold 18px system-ui, sans-serif";
            ctx.fillText((user.position || "Hospital Personnel").toUpperCase(), cx, 530);
          }

          // Horizontal dashed separator
          ctx.strokeStyle = "#cbd5e1";
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(80, 560);
          ctx.lineTo(width - 80, 560);
          ctx.stroke();
          ctx.setLineDash([]); // Reset dash

          // Draw QR code image
          if (qrDataUrl) {
            const qrImg = new Image();
            const qrSize = 210;
            const qx = cx - qrSize / 2;
            const qy = 590;

            // Background frame for QR
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 12;
            ctx.fillRect(qx - 15, qy - 15, qrSize + 30, qrSize + 30);
            ctx.shadowBlur = 0; // Reset shadow

            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 2;
            ctx.strokeRect(qx - 15, qy - 15, qrSize + 30, qrSize + 30);

            await new Promise<void>((resolve) => {
              qrImg.onload = () => {
                ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
                resolve();
              };
              qrImg.src = qrDataUrl;
            });
          }

          // Details Block (Two column row at bottom)
          const blockY = 875;
          ctx.fillStyle = "#f8fafc";
          ctx.fillRect(80, blockY, width - 160, 60);
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.strokeRect(80, blockY, width - 160, 60);

          ctx.fillStyle = "#94a3b8";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText("EMPLOYEE NO", 100, blockY + 22);
          ctx.fillText("DEPARTMENT", cx + 20, blockY + 22);

          ctx.fillStyle = selectedTheme.dark;
          ctx.font = "bold 15px system-ui, sans-serif";
          ctx.fillText(user.employee_no || "N/A", 100, blockY + 44);
          
          let deptName = "Dietary Services";
          if (user.department_id === 1) deptName = "ICT Department";
          else if (user.department_id === 2) deptName = "Nursing Department";
          else if (user.department_id === 3) deptName = "Emergency Room Services";
          else if (user.department_id === 5) deptName = "Cardiology Unit";
          ctx.fillText(showDepartment ? deptName : "Divine Grace Staff", cx + 20, blockY + 44);
          
          if (showHireDate) {
              ctx.fillStyle = "#94a3b8";
              ctx.font = "bold 11px system-ui, sans-serif";
              ctx.textAlign = "left";
              ctx.fillText("ISSUED", 100, blockY + 55);
              ctx.fillStyle = selectedTheme.dark;
              ctx.font = "bold 15px system-ui, sans-serif";
              ctx.fillText(user.hire_date ? new Date(user.hire_date).toLocaleDateString() : "Active", 100, blockY + 70);
          }

          // Footer disclaimer
          if (showDisclaimer) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "normal 10px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`PROPERTY OF ${branding.companyName.toUpperCase()}`, cx, 965);
            ctx.fillText("STRICTLY NON-TRANSFERABLE • MEAL ENTITLEMENT VOUCHER", cx, 982);
          }

        } else {
          // --- LANDSCAPE BADGE GRAPHICS DRAWING ---
          // Left side Banner block
          ctx.fillStyle = selectedTheme.id === "cosmic" ? "#090d16" : selectedTheme.primary;
          ctx.fillRect(0, 0, 320, height);

          // Side decorative gold line
          ctx.fillStyle = selectedTheme.accentColor;
          ctx.fillRect(315, 0, 5, height);

          // Header Hospital Cross badge on Left Panel
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          const lcx = 160;
          const lcy = 100;
          ctx.fillRect(lcx - 8, lcy - 25, 16, 50);
          ctx.fillRect(lcx - 25, lcy - 8, 50, 16);

          // Header Hospital Title left panel
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(branding.companyName.toUpperCase(), lcx, 180);

          ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText("DIETARY MANAGEMENT PASS", lcx, 210);

          // QR Code on Left Panel
          if (qrDataUrl) {
            const qrImg = new Image();
            const qrSize = 180;
            const qx = lcx - qrSize / 2;
            const qy = 250;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(qx - 10, qy - 10, qrSize + 20, qrSize + 20);

            await new Promise<void>((resolve) => {
              qrImg.onload = () => {
                ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
                resolve();
              };
              qrImg.src = qrDataUrl;
            });

            // QR subtext
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px system-ui, sans-serif";
            ctx.fillText(`TOKEN: ${user.qr_code || "N/A"}`, lcx, 470);
          }

          // --- RIGHT SIDE PANEL: PERSONNEL ---
          const rx = 360;

          // Avatar Profile Block
          const avatarSize = 130;
          const ay = 60;
          const ax = width - avatarSize - 60;

          ctx.save();
          ctx.beginPath();
          ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.clip();

          if (avatarType === "uploaded" && uploadedPhoto) {
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                ctx.drawImage(img, ax, ay, avatarSize, avatarSize);
                resolve();
              };
              img.src = uploadedPhoto;
            });
          } else {
            // Fallback vector profile inside circle
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(ax, ay, avatarSize, avatarSize);
            ctx.fillStyle = selectedTheme.primary;
            ctx.beginPath();
            ctx.arc(ax + avatarSize / 2, ay + avatarSize * 1.2, avatarSize * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(ax + avatarSize / 2, ay + avatarSize * 0.5, avatarSize * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Border around avatar
          ctx.strokeStyle = selectedTheme.accentColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.stroke();

          // Personnel Names (Align left on right column)
          ctx.fillStyle = selectedTheme.primary;
          ctx.font = "bold 36px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`${user.first_name} ${user.last_name}`, rx, 100);

          if (showPosition) {
            ctx.fillStyle = "#4b5563";
            ctx.font = "bold 16px system-ui, sans-serif";
            ctx.fillText((user.position || "Hospital Personnel").toUpperCase(), rx, 135);
          }

          // Grid Metadata fields on right panel
          const labelsY = 220;
          ctx.fillStyle = "#94a3b8";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.fillText("EMPLOYEE NO", rx, labelsY);
          ctx.fillText("DEPARTMENT", rx + 200, labelsY);

          ctx.fillStyle = selectedTheme.dark;
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.fillText(user.employee_no || "N/A", rx, labelsY + 30);
          
          let deptName = "Dietary Services";
          if (user.department_id === 1) deptName = "ICT Department";
          else if (user.department_id === 2) deptName = "Nursing Department";
          else if (user.department_id === 3) deptName = "Emergency Room Services";
          else if (user.department_id === 5) deptName = "Cardiology Unit";
          ctx.fillText(showDepartment ? deptName : "Divine Grace Staff", rx + 200, labelsY + 30);
          
          if (showHireDate) {
              ctx.fillStyle = "#94a3b8";
              ctx.font = "bold 11px system-ui, sans-serif";
              ctx.fillText("ISSUED", rx + 400, labelsY);
              ctx.fillStyle = selectedTheme.dark;
              ctx.font = "bold 18px system-ui, sans-serif";
              ctx.fillText(user.hire_date ? new Date(user.hire_date).toLocaleDateString() : "Active", rx + 400, labelsY + 30);
          }

          // Custom verification sticker
          ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
          ctx.fillRect(rx, 310, width - rx - 60, 110);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, 310, width - rx - 60, 110);

          ctx.fillStyle = "#059669";
          ctx.font = "bold 14px system-ui, sans-serif";
          ctx.fillText("✓ VERIFIED MEDICAL DIETARY BENEFITS", rx + 20, 345);

          ctx.fillStyle = "#475569";
          ctx.font = "normal 11px system-ui, sans-serif";
          ctx.fillText("Authorized to receive 1 standard free meal voucher allocation", rx + 20, 375);
          ctx.fillText("per qualified duty shift roster. Subject to continuous validation.", rx + 20, 395);

          // Horizontal footer line
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx, 460);
          ctx.lineTo(width - 60, 460);
          ctx.stroke();

          if (showDisclaimer) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "normal 10px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`PROPERTY OF ${branding.companyName.toUpperCase()} • SECURITY SYSTEM GATEWAY CLAIMS`, (width + 320) / 2, 510);
          }
        }
      }

      // 4. Trigger download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `DGMC_Badge_${user.first_name}_${user.last_name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Failed to render high-DPI canvas PNG", e);
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const isPortrait = orientation === "portrait";

  // Get department name
  const getDeptDisplay = () => {
    if (!user.department_id) return "Divine Grace Medical Center";
    if (user.department_id === 1) return "ICT Department";
    if (user.department_id === 2) return "Nursing Department";
    if (user.department_id === 3) return "Emergency Room Services";
    if (user.department_id === 4) return "Dietary Services";
    if (user.department_id === 5) return "Cardiology Unit";
    return "Hospital Staff";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      
      {/* Dynamic Style Sheet block injected for strict print formatting */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${isPortrait ? '2.125in 3.375in' : '3.375in 2.125in'};
            margin: 0 !important;
          }
          
          /* Hide all general UI and containers */
          html, body {
            width: ${isPortrait ? '2.125in' : '3.375in'} !important;
            height: ${isPortrait ? '3.375in' : '2.125in'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide anything that is not our actual target card block */
          #root, .non-printable, header, nav, footer, sidebar, aside, div:not(.print-card-wrapper):not(.printable-badge-card) {
            display: none !important;
          }

          /* Force print card wrapper to stand-alone fill full screen page */
          .print-card-wrapper {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: ${isPortrait ? '2.125in' : '3.375in'} !important;
            height: ${isPortrait ? '3.375in' : '2.125in'} !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 9999999 !important;
            background: #ffffff !important;
          }

          .printable-badge-card {
            display: flex !important;
            width: ${isPortrait ? '2.125in' : '3.375in'} !important;
            height: ${isPortrait ? '3.375in' : '2.125in'} !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
        }
      `}} />

      {/* Screen Header and Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm non-printable">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-1.5 bg-teal-50 rounded-lg text-teal-600 block">
              <QrCode className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-zinc-950 tracking-tight">Enterprise Pass Builder</h1>
          </div>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            Configure, download, and print your physical, high-resolution hospital dietary meal voucher ID badge.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user.role === "admin" || user.role === "manager") && (
            <button
              onClick={handleFetchBatchExport}
              disabled={batchLoading}
              className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102 disabled:opacity-50 cursor-pointer"
            >
              {batchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              <span>Export QR Codes (Batch)</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="h-10 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge (CR80)</span>
          </button>

          <button
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            className="h-10 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102 disabled:opacity-50"
          >
            {isGeneratingPng ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download High-Res PNG</span>
          </button>
        </div>
      </div>

      {/* Roster Information Guidelines Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-3 non-printable">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 leading-relaxed">
          <p className="font-extrabold uppercase tracking-wider text-emerald-800 text-[10px] font-mono">Hospital Roster Verified</p>
          <p className="mt-0.5 font-medium text-emerald-900">
            This card contains your verified, base64-encrypted credential token. Flash the badge at cashier terminals for shift meal credits. When printing, select <span className="font-bold">Scale: 100% (No Margins)</span> to match CR80 size dimensions.
          </p>
        </div>
      </div>

      {/* Segmented control for switching mode */}
      <div className="flex bg-zinc-100 p-1 rounded-2xl max-w-md non-printable border border-zinc-200 shadow-3xs">
        <button
          onClick={() => setPassMode("badge")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            passMode === "badge"
              ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/50"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Complete ID Badge</span>
        </button>
        <button
          onClick={() => setPassMode("standalone")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            passMode === "standalone"
              ? "bg-white text-zinc-950 shadow-sm border border-zinc-200/50"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Standalone QR Pass</span>
        </button>
      </div>

      {/* Main Grid: Left Customizer controls, Right Card Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start non-printable">
        
        {/* LEFT COLUMN: CUSTOMIZER ENGINE (Lg: col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          
          {/* Settings Tabs Header */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-2">
            <button
              onClick={() => setActiveTab("layout")}
              className={`flex-1 py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "layout" 
                  ? "bg-white border border-zinc-200 text-zinc-900 shadow-3xs" 
                  : "text-zinc-550 hover:text-zinc-800"
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span>Layout &amp; Orientation</span>
            </button>
            
            <button
              onClick={() => setActiveTab("appearance")}
              className={`flex-1 py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "appearance" 
                  ? "bg-white border border-zinc-200 text-zinc-900 shadow-3xs" 
                  : "text-zinc-550 hover:text-zinc-800"
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-zinc-500" />
              <span>Identity &amp; Presets</span>
            </button>

            <button
              onClick={() => setActiveTab("help")}
              className={`flex-1 py-2.5 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "help" 
                  ? "bg-white border border-zinc-200 text-zinc-900 shadow-3xs" 
                  : "text-zinc-550 hover:text-zinc-800"
              }`}
            >
              <Info className="w-3.5 h-3.5 text-zinc-500" />
              <span>Print Guide</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* TAB 1: LAYOUT & CONFIG */}
            {activeTab === "layout" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* 1. Orientation Selection */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block mb-3">
                    Card Orientation Format
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setOrientation("portrait")}
                      className={`p-4 border rounded-2xl transition-all flex flex-col items-center gap-2 ${
                        isPortrait 
                          ? "border-teal-700 bg-teal-50/20 text-teal-900 ring-1 ring-teal-700" 
                          : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600"
                      }`}
                    >
                      <div className="w-10 h-14 border-2 border-dashed border-current rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase rotate-90">ID</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold block leading-none">Portrait Badge</span>
                        <span className="text-[9px] font-mono text-zinc-400 mt-1 block">Standard Clip Slot (2.12" x 3.37")</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setOrientation("landscape")}
                      className={`p-4 border rounded-2xl transition-all flex flex-col items-center gap-2 ${
                        orientation === "landscape" 
                          ? "border-teal-700 bg-teal-50/20 text-teal-900 ring-1 ring-teal-700" 
                          : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600"
                      }`}
                    >
                      <div className="w-14 h-10 border-2 border-dashed border-current rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase">ID</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold block leading-none">Landscape Badge</span>
                        <span className="text-[9px] font-mono text-zinc-400 mt-1 block">Standard Pocket Card (3.37" x 2.12")</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Visual Content Toggles */}
                <div className="border-t border-zinc-100 pt-6">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block mb-3">
                    Display Parameters &amp; Badges
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Hospital Department</span>
                        <span className="text-[9px] text-zinc-400">Include nursing/dietary division logo</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showDepartment} 
                        onChange={(e) => setShowDepartment(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Job Position / Title</span>
                        <span className="text-[9px] text-zinc-400">Display verified personnel role title</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showPosition} 
                        onChange={(e) => setShowPosition(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Roster Hire Date</span>
                        <span className="text-[9px] text-zinc-400">Verify entry/registration date</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showHireDate} 
                        onChange={(e) => setShowHireDate(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Security Disclaimer</span>
                        <span className="text-[9px] text-zinc-400">Include Mount Grace property terms</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showDisclaimer} 
                        onChange={(e) => setShowDisclaimer(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Print Cut-Guide Outlines</span>
                        <span className="text-[9px] text-zinc-400">Dotted scissor crop-marks on page</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={showGuideLines} 
                        onChange={(e) => setShowGuideLines(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-zinc-150 rounded-xl hover:bg-zinc-50 cursor-pointer transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-800">Card Frame Decoration</span>
                        <span className="text-[9px] text-zinc-400">Thick ID holder sleeve preview outline</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={badgeHolderFrame} 
                        onChange={(e) => setBadgeHolderFrame(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-zinc-300"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-teal-200 rounded-xl hover:bg-teal-50/40 cursor-pointer transition-colors col-span-1 md:col-span-2 bg-teal-50/10">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-teal-900">Cryptographic Protection (OTP)</span>
                          <span className="px-1.5 py-0.5 text-[7px] font-mono font-bold bg-teal-700 text-white rounded">SECURE PASS</span>
                        </div>
                        <span className="text-[9px] text-teal-700">Rotates signature every 45s to block screen capture forgery</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={useSecureCrypto} 
                        onChange={(e) => setUseSecureCrypto(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-teal-300"
                      />
                    </label>

                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: APPEARANCE & PRESETS */}
            {activeTab === "appearance" && (
              <div className="space-y-6 animate-fade-in">
                
                {/* 1. Theme Selection */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block mb-3">
                    Hospital Brand Presets &amp; Clinical Themes
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {THEME_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedTheme(p)}
                        className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all ${
                          selectedTheme.id === p.id 
                            ? "border-teal-700 bg-teal-50/20 text-teal-900 ring-1 ring-teal-700" 
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span 
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0 block"
                            style={{ backgroundColor: p.primary }}
                          />
                          <span className="text-xs font-bold text-zinc-800">{p.name}</span>
                        </div>
                        <span 
                          className="w-2.5 h-2.5 rounded-full block" 
                          style={{ backgroundColor: p.accentColor }} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Photo / Avatar Setup */}
                <div className="border-t border-zinc-100 pt-6">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block mb-3.5">
                    Personnel Avatar &amp; Identification Photo
                  </label>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-5 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-200 bg-white shrink-0 relative shadow-inner">
                      {renderAvatarContent()}
                    </div>
                    
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setAvatarType("physician_m")}
                          className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md border ${
                            avatarType === "physician_m" 
                              ? "bg-teal-700 text-white border-teal-700" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          Doctor (Male)
                        </button>
                        <button
                          onClick={() => setAvatarType("physician_f")}
                          className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md border ${
                            avatarType === "physician_f" 
                              ? "bg-teal-700 text-white border-teal-700" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          Doctor (Female)
                        </button>
                        <button
                          onClick={() => setAvatarType("nurse")}
                          className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md border ${
                            avatarType === "nurse" 
                              ? "bg-teal-700 text-white border-teal-700" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          Nurse / Medic
                        </button>
                        <button
                          onClick={() => setAvatarType("admin")}
                          className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md border ${
                            avatarType === "admin" 
                              ? "bg-teal-700 text-white border-teal-700" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          Admin Staff
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                          className="hidden" 
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 px-3.5 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg text-[10px] font-bold flex items-center gap-1.5 text-zinc-700 shadow-3xs"
                        >
                          <Upload className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Upload Real Photo</span>
                        </button>
                        
                        {uploadedPhoto && (
                          <button
                            onClick={handleResetPhoto}
                            className="h-8 px-3 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-bold transition-colors"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: HELP & PRINT DIRECTIVES */}
            {activeTab === "help" && (
              <div className="space-y-4 animate-fade-in text-xs leading-relaxed text-zinc-600 font-sans">
                <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-900">
                  <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold uppercase tracking-wide text-[10px] font-mono text-amber-800">Critical Printing Guidelines</h5>
                    <p className="mt-1 font-medium">
                      To guarantee the printed voucher fits perfectly into card holders or laminating jackets without scaling distortions:
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pl-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <p>
                      <strong>Standard Card Format:</strong> This generator targets the physical CR80 Standard ID Card size dimensions (<span className="font-bold">3.375" x 2.125" / 85.6mm x 54mm</span>).
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <p>
                      <strong>Printer Scale Settings:</strong> Inside your browser's Print Dialog, set <span className="font-bold text-teal-850 bg-teal-50 px-1 rounded">Scale: 100%</span> or <span className="font-bold text-teal-850 bg-teal-50 px-1 rounded">Scale: Actual Size</span>. Do NOT use "Fit to Page" or "Scale to Fit".
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <p>
                      <strong>Enable Background Graphics:</strong> Crucial to printing colored borders and backgrounds. Check the box labeled <span className="font-bold">"Background graphics"</span> in the Print settings sheet.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                    <p>
                      <strong>Hardware Recommendation:</strong> Print on thick cardstock paper (e.g. 250gsm+), PVC printable card trays, or standard adhesive paper for durable hospital badge backings.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE PREVIEW PANEL (Lg: col-span-5) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          <div className="w-full text-center mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
              Active Screen Preview (Scaled)
            </span>
          </div>

          {/* Fully Interactive ID Card Rendering Frame */}
          <div className="p-8 border border-zinc-200 bg-zinc-50 border-dashed rounded-3xl w-full flex items-center justify-center min-h-[460px] relative overflow-hidden shadow-inner">
            
            {/* Guide Gridlines Layer (Scaffolding preview) */}
            {showGuideLines && (
              <div className="absolute inset-0 pointer-events-none border border-zinc-200/50 flex flex-col justify-between p-4">
                <div className="flex justify-between text-[9px] text-zinc-350 font-mono">
                  <span>CR80 CUT GUIDE 1A</span>
                  <span>CR80 CUT GUIDE 1B</span>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-350 font-mono">
                  <span>85.6mm</span>
                  <span>54mm</span>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-350 font-mono">
                  <span>CR80 CUT GUIDE 2A</span>
                  <span>CR80 CUT GUIDE 2B</span>
                </div>
              </div>
            )}

            {/* Simulated Badge Plastic Holder Ring */}
            {badgeHolderFrame && (
              <div className="absolute top-2 w-14 h-4 bg-zinc-200/80 border border-zinc-300 rounded-full z-10 flex items-center justify-center shadow-xs">
                <div className="w-6 h-1.5 bg-zinc-700/60 rounded-full"></div>
              </div>
            )}

            {/* CARD WRAPPER FRAME WITH EXACT ASPECT RATIO CORRECTIONS */}
            <div 
              id="printable-id-badge"
              className={`bg-white border-2 border-zinc-200 overflow-hidden shadow-2xl relative select-none transition-all duration-300 ${
                isPortrait 
                  ? "w-[260px] h-[413px] rounded-2xl" 
                  : "w-[413px] h-[260px] rounded-2xl"
              }`}
              style={{
                borderColor: selectedTheme.primary,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)"
              }}
            >
              
              {/* PORTRAIT LIVE Badging Layout */}
              {passMode === "standalone" ? (
                isPortrait ? (
                  /* STANDALONE PORTRAIT LIVE SCREEN PREVIEW */
                  <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0 border border-zinc-100 rounded-2xl relative">
                    <div className="bg-zinc-50 border-b border-zinc-150 p-4 text-center">
                      <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none">{branding.companyName}</h4>
                      <p className="text-[7.5px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Standalone Dietary Token</p>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
                      {/* Large framed QR code */}
                      <div className="relative w-32 h-32 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center p-2 shadow-sm shrink-0">
                        {qrDataUrl ? (
                          <img 
                            src={qrDataUrl} 
                            alt="Standalone QR Pass" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      {useSecureCrypto ? (
                        <div className="flex flex-col items-center gap-0.5 mt-0.5">
                          <span className="text-[6.5px] font-bold text-teal-650 flex items-center gap-0.5 leading-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse text-teal-500"></span>
                            SECURE OTP ACTIVE
                          </span>
                          <span className="text-[5.5px] font-mono text-zinc-400 uppercase leading-none mt-0.5">ROTATING IN {secureExpiresIn}s</span>
                        </div>
                      ) : (
                        <span className="text-[7px] font-mono text-zinc-400 tracking-widest">TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                      )}
                    </div>

                    <div className="p-4 border-t border-zinc-150 bg-zinc-50 text-center">
                      <h5 className="text-xs font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h5>
                      <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{user.position || "Hospital Personnel"}</p>
                      
                      <div className="mt-2 flex items-center justify-center gap-1">
                        <span className="text-[7px] font-mono font-bold text-zinc-400">ID NO:</span>
                        <span className="text-[8px] font-mono font-black text-zinc-800 bg-white border border-zinc-150 px-1.5 py-0.5 rounded">{user.employee_no || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STANDALONE LANDSCAPE LIVE SCREEN PREVIEW */
                  <div className="w-full h-full flex bg-white text-zinc-950 p-0 rounded-2xl border border-zinc-100">
                    <div className="w-40 border-r border-zinc-150 bg-zinc-50 p-4 flex flex-col items-center justify-center text-center">
                      <div className="relative w-28 h-28 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1.5 shadow-sm shrink-0">
                        {qrDataUrl ? (
                          <img 
                            src={qrDataUrl} 
                            alt="Standalone QR Pass" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                      {useSecureCrypto ? (
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                          <span className="text-[6px] font-bold text-teal-650 flex items-center gap-0.5 leading-none">
                            <span className="w-1 h-1 rounded-full bg-teal-500 animate-pulse"></span>
                            SECURE OTP
                          </span>
                          <span className="text-[5px] font-mono text-zinc-400 leading-none">REFRESH IN {secureExpiresIn}s</span>
                        </div>
                      ) : (
                        <span className="text-[6.5px] font-mono text-zinc-400 mt-2 tracking-widest">TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                      )}
                    </div>

                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none">{branding.companyName}</h4>
                        <p className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-1">Standalone Dietary Token</p>
                        <div className="h-px bg-zinc-150 my-2" />
                      </div>

                      <div>
                        <h5 className="text-sm font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h5>
                        <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{user.position || "Hospital Personnel"}</p>
                        <p className="text-[7.5px] font-mono mt-1 text-zinc-400">ID: {user.employee_no || "N/A"}</p>
                      </div>

                      <div className="text-[6px] text-emerald-600 bg-emerald-50 border border-emerald-150 rounded px-1.5 py-1 font-bold flex items-center gap-1 leading-none">
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                        <span>VERIFIED SHIFT CLAIM CREDENTIAL</span>
                      </div>
                    </div>
                  </div>
                )
              ) : isPortrait ? (
                <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0">
                  
                  {/* Top Header Banner */}
                  <div className={`p-4 text-center flex flex-col items-center shrink-0 ${selectedTheme.bannerBg} relative`}>
                    
                    {/* Tiny medical cross icon in background */}
                    <div className="absolute right-3 top-3 opacity-15">
                      <svg viewBox="0 0 100 100" className="w-8 h-8 fill-white">
                        <rect x="35" y="10" width="30" height="80" rx="4" />
                        <rect x="10" y="35" width="80" height="30" rx="4" />
                      </svg>
                    </div>

                    <h3 className="text-[10px] font-black uppercase tracking-wider text-white leading-none mb-1">
                      {branding.companyName}
                    </h3>
                    <p className="text-[7px] text-zinc-300 font-mono tracking-widest uppercase">Dietary Services Pass</p>
                    
                    <div 
                      className="text-[6px] font-bold font-mono tracking-widest uppercase py-0.5 px-2 rounded mt-2 border border-white/20 inline-block text-white"
                      style={{ backgroundColor: selectedTheme.accentColor }}
                    >
                      Verified personnel
                    </div>
                  </div>

                  {/* Body Block */}
                  <div className="flex-1 flex flex-col items-center justify-between p-4 text-center bg-white">
                    
                    {/* Avatar preview frame */}
                    <div className="w-20 h-20 rounded-full border-2 border-zinc-100 overflow-hidden relative shadow-md shrink-0 bg-white" style={{ borderColor: selectedTheme.accentColor }}>
                      {renderAvatarContent()}
                    </div>

                    {/* Personnel identifiers */}
                    <div className="space-y-0.5 mt-1">
                      <h4 className="text-sm font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h4>
                      {showPosition && (
                        <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">{user.position || "Medical Staff"}</p>
                      )}
                    </div>

                    {/* QR block code frame */}
                    <div className="relative w-28 h-28 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1.5 overflow-hidden shadow-sm shrink-0">
                      {qrDataUrl ? (
                        <img 
                          src={qrDataUrl} 
                          alt="Personnel QR Code Badge" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {useSecureCrypto && (
                        <div className="absolute inset-x-0 bottom-0 bg-teal-700 text-white text-[5.5px] font-mono py-0.5 font-bold flex items-center justify-center gap-0.5 leading-none">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>ROTATING OTP: {secureExpiresIn}s</span>
                        </div>
                      )}
                    </div>

                    {/* Horizontal Roster data indicators */}
                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 w-full text-[7px] font-mono text-zinc-600">
                      <div className="text-left">
                        <span className="text-zinc-400 block font-bold leading-none">EMP ID:</span>
                        <span className="font-black text-zinc-900 block mt-0.5">{user.employee_no || "N/A"}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-400 block font-bold leading-none">DIVISION:</span>
                        <span className="font-black text-zinc-900 truncate block mt-0.5">{showDepartment ? getDeptDisplay() : "Divine Grace Staff"}</span>
                      </div>
                      {showHireDate && (
                        <div className="text-left">
                          <span className="text-zinc-400 block font-bold leading-none">ISSUED:</span>
                          <span className="font-black text-zinc-900 block mt-0.5">
                            {user.hire_date ? new Date(user.hire_date).toLocaleDateString() : "Active"}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Tiny disclaimer note */}
                  {showDisclaimer && (
                    <div className="text-[6px] font-mono bg-zinc-50 border-t border-zinc-100 py-1.5 text-center text-zinc-400 uppercase tracking-tight shrink-0">
                      Property of {branding.companyName} • Authorized use only
                    </div>
                  )}

                </div>
              ) : (
                
                // LANDSCAPE LIVE Badging Layout
                <div className="w-full h-full flex bg-white text-zinc-950 p-0">
                  
                  {/* Left Column Banner panel */}
                  <div className={`w-36 h-full flex flex-col justify-between p-3.5 text-center shrink-0 border-r border-zinc-100 ${selectedTheme.bannerBg} relative`}>
                    
                    <div className="space-y-1">
                      <h3 className="text-[9px] font-black uppercase tracking-wider text-white leading-tight">
                        {branding.companyName}
                      </h3>
                      <p className="text-[6px] text-zinc-400 font-mono uppercase tracking-widest">Dietary Pass</p>
                    </div>

                    {/* QR inside Left block */}
                    <div className="w-24 h-24 bg-white border border-zinc-150 rounded-lg flex items-center justify-center p-1 mx-auto my-1 shadow-sm relative overflow-hidden">
                      {qrDataUrl ? (
                        <img 
                          src={qrDataUrl} 
                          alt="Voucher Code" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {useSecureCrypto && (
                        <div className="absolute inset-x-0 bottom-0 bg-teal-700 text-white text-[5px] font-mono py-0.5 font-bold flex items-center justify-center gap-0.5 leading-none">
                          <span>OTP: {secureExpiresIn}s</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[6px] font-mono text-white bg-white/10 py-0.5 rounded border border-white/5 truncate">
                      {useSecureCrypto ? "SECURE SEC-OTP" : `TKN: ${user.qr_code || "EMP-001"}`}
                    </div>

                  </div>

                  {/* Right Column Personnel details panel */}
                  <div className="flex-1 flex flex-col justify-between p-4 bg-white">
                    
                    {/* Top layout line */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <h4 className="text-base font-black text-zinc-900 leading-tight tracking-tight">
                          {user.first_name} {user.last_name}
                        </h4>
                        {showPosition && (
                          <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">
                            {user.position || "Medical Officer"}
                          </p>
                        )}
                      </div>

                      {/* Avatar inside Landscape */}
                      <div className="w-14 h-14 rounded-full border border-zinc-100 overflow-hidden shrink-0 relative bg-white" style={{ borderColor: selectedTheme.accentColor }}>
                        {renderAvatarContent()}
                      </div>
                    </div>

                    {/* Data grid items inside Landscape */}
                    <div className="grid grid-cols-2 gap-3 border-t border-dashed border-zinc-200 pt-3 text-[8px] font-mono text-zinc-600">
                      <div>
                        <span className="text-zinc-400 block font-bold leading-none uppercase">Emp ID</span>
                        <span className="font-black text-zinc-950 block mt-0.5">{user.employee_no || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block font-bold leading-none uppercase">Department</span>
                        <span className="font-black text-zinc-950 truncate block mt-0.5">{showDepartment ? getDeptDisplay() : "Divine Grace Staff"}</span>
                      </div>
                      
                      {showHireDate && (
                        <div>
                          <span className="text-zinc-400 block font-bold leading-none uppercase">Issued</span>
                          <span className="font-black text-zinc-950 block mt-0.5">
                            {user.hire_date ? new Date(user.hire_date).toLocaleDateString() : "Active duty"}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-zinc-400 block font-bold leading-none uppercase">Status</span>
                        <span className="font-extrabold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </span>
                      </div>
                    </div>

                    {/* Tiny watermark disclaimer at bottom of right column */}
                    {showDisclaimer && (
                      <div className="text-[6px] font-sans text-zinc-400 uppercase tracking-tight pt-1.5 border-t border-zinc-100">
                        DGMC DIETARY UNIT • VOUCHER VALID ONLY DURING SHIFTS
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>
          </div>
          
          {/* Helpful advice under preview */}
          <p className="text-[10px] text-zinc-400 font-mono mt-3 text-center">
            Aspect ratio calibrated precisely to ISO/IEC 7810 ID-1 standard sizing (85.6mm x 53.98mm).
          </p>

        </div>

      </div>

      {/* DEDICATED PRINT CONTAINER - HIDDEN ON SCREEN, RE-STYLED ENTIRELY ON PRINT */}
      <div className="hidden print-card-wrapper">
        <div className="printable-badge-card bg-white" style={{ borderColor: selectedTheme.primary }}>
          {passMode === "standalone" ? (
            isPortrait ? (
              /* STANDALONE PORTRAIT PRINT */
              <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0 relative border border-zinc-200" style={{ width: '2.125in', height: '3.375in' }}>
                <div className="bg-zinc-50 border-b border-zinc-150 p-2 text-center" style={{ padding: '6px' }}>
                  <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none" style={{ fontSize: '7.5pt' }}>{branding.companyName}</h4>
                  <p className="text-[7.5px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5" style={{ fontSize: '5pt' }}>Standalone Dietary Token</p>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-2 gap-1" style={{ padding: '8px' }}>
                  <div className="relative w-28 h-28 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0" style={{ width: '80px', height: '80px' }}>
                    {qrDataUrl && (
                      <img 
                        src={qrDataUrl} 
                        alt="Standalone QR Pass" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <span className="text-[7px] font-mono text-zinc-400 tracking-widest" style={{ fontSize: '4.5pt' }}>TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                </div>

                <div className="p-2 border-t border-zinc-150 bg-zinc-50 text-center" style={{ padding: '6px' }}>
                  <h5 className="text-xs font-black text-zinc-900 leading-none" style={{ fontSize: '8.5pt' }}>{user.first_name} {user.last_name}</h5>
                  <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5" style={{ fontSize: '5.5pt' }}>{user.position || "Hospital Personnel"}</p>
                  
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <span className="text-[7px] font-mono font-bold text-zinc-400" style={{ fontSize: '4.5pt' }}>ID NO:</span>
                    <span className="text-[8px] font-mono font-black text-zinc-800 bg-white border border-zinc-150 px-1.5 py-0.5 rounded" style={{ fontSize: '5.5pt', padding: '1px 3px' }}>{user.employee_no || "N/A"}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* STANDALONE LANDSCAPE PRINT */
              <div className="w-full h-full flex bg-white text-zinc-950 p-0 relative border border-zinc-200" style={{ width: '3.375in', height: '2.125in' }}>
                <div className="w-28 border-r border-zinc-150 bg-zinc-50 p-2 flex flex-col items-center justify-center text-center" style={{ width: '1.25in', padding: '6px' }}>
                  <div className="relative w-24 h-24 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0" style={{ width: '70px', height: '70px' }}>
                    {qrDataUrl && (
                      <img 
                        src={qrDataUrl} 
                        alt="Standalone QR Pass" 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <span className="text-[6.5px] font-mono text-zinc-400 mt-1 tracking-widest" style={{ fontSize: '4.5pt' }}>TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                </div>

                <div className="flex-1 p-2 flex flex-col justify-between" style={{ padding: '8px' }}>
                  <div>
                    <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none" style={{ fontSize: '7.5pt' }}>{branding.companyName}</h4>
                    <p className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5" style={{ fontSize: '5pt' }}>Standalone Dietary Token</p>
                    <div className="h-px bg-zinc-150 my-1" />
                  </div>

                  <div>
                    <h5 className="text-sm font-black text-zinc-900 leading-none" style={{ fontSize: '8.5pt' }}>{user.first_name} {user.last_name}</h5>
                    <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5" style={{ fontSize: '5.5pt' }}>{user.position || "Hospital Personnel"}</p>
                    <p className="text-[7.5px] font-mono mt-0.5 text-zinc-400" style={{ fontSize: '5pt' }}>ID: {user.employee_no || "N/A"}</p>
                  </div>

                  <div className="text-[6px] text-emerald-600 bg-emerald-50 border border-emerald-150 rounded px-1 py-0.5 font-bold flex items-center gap-0.5 leading-none" style={{ fontSize: '4.5pt', padding: '2px 4px' }}>
                    <span>VERIFIED SHIFT CLAIM CREDENTIAL</span>
                  </div>
                </div>
              </div>
            )
          ) : isPortrait ? (
            <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0 relative" style={{ width: '2.125in', height: '3.375in' }}>
              
              {/* Header block on portrait printed card */}
              <div className={`p-4 text-center flex flex-col items-center shrink-0 ${selectedTheme.bannerBg} relative`} style={{ height: '0.85in', padding: '10px' }}>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-white leading-none mb-1" style={{ fontSize: '7.5pt' }}>
                  {branding.companyName}
                </h3>
                <p className="text-[6px] text-zinc-300 font-mono tracking-widest uppercase" style={{ fontSize: '4.5pt' }}>Dietary Services Pass</p>
                <div 
                  className="text-[6px] font-bold font-mono tracking-widest uppercase py-0.5 px-2 rounded mt-1 border border-white/20 inline-block text-white"
                  style={{ backgroundColor: selectedTheme.accentColor, fontSize: '4.5pt', padding: '1px 4px' }}
                >
                  Verified personnel
                </div>
              </div>

              {/* Body block on portrait printed card */}
              <div className="flex-1 flex flex-col items-center justify-between p-4 text-center bg-white" style={{ padding: '10px' }}>
                <div className="w-16 h-16 rounded-full border-2 border-zinc-100 overflow-hidden relative shadow-md shrink-0 bg-white" style={{ borderColor: selectedTheme.accentColor, width: '54px', height: '54px' }}>
                  {renderAvatarContent()}
                </div>

                <div className="space-y-0.5 mt-1">
                  <h4 className="text-sm font-black text-zinc-900 leading-none" style={{ fontSize: '10pt' }}>{user.first_name} {user.last_name}</h4>
                  {showPosition && (
                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider" style={{ fontSize: '6pt' }}>{user.position || "Medical Staff"}</p>
                  )}
                </div>

                <div className="relative w-24 h-24 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 overflow-hidden shrink-0" style={{ width: '80px', height: '80px' }}>
                  {qrDataUrl && (
                    <img 
                      src={qrDataUrl} 
                      alt="Voucher QR Code" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-1 w-full text-[7px] font-mono text-zinc-600" style={{ fontSize: '5pt' }}>
                  <div className="text-left">
                    <span className="text-zinc-400 block font-bold leading-none">EMP ID:</span>
                    <span className="font-black text-zinc-900 block mt-0.5">{user.employee_no || "N/A"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-400 block font-bold leading-none">DIVISION:</span>
                    <span className="font-black text-zinc-900 truncate block mt-0.5">{getDeptDisplay()}</span>
                  </div>
                </div>
              </div>

              {showDisclaimer && (
                <div className="text-[6px] font-mono bg-zinc-50 border-t border-zinc-100 py-1 text-center text-zinc-400 uppercase tracking-tight shrink-0" style={{ fontSize: '4.5pt', padding: '3px 0' }}>
                  Property of {branding.companyName} • Authorized use only
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex bg-white text-zinc-950 p-0 relative" style={{ width: '3.375in', height: '2.125in' }}>
              
              {/* Landscape left banner in print card */}
              <div className={`w-32 h-full flex flex-col justify-between p-3 text-center shrink-0 border-r border-zinc-100 ${selectedTheme.bannerBg}`} style={{ width: '1.25in', padding: '8px' }}>
                <div className="space-y-1">
                  <h3 className="text-[9px] font-black uppercase tracking-wider text-white leading-tight" style={{ fontSize: '6.5pt' }}>
                    {branding.companyName}
                  </h3>
                  <p className="text-[6px] text-zinc-400 font-mono uppercase tracking-widest" style={{ fontSize: '4.5pt' }}>Dietary Pass</p>
                </div>

                <div className="w-20 h-20 bg-white border border-zinc-150 rounded-lg flex items-center justify-center p-1 mx-auto shadow-sm" style={{ width: '64px', height: '64px' }}>
                  {qrDataUrl && (
                    <img 
                      src={qrDataUrl} 
                      alt="Voucher QR Code" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                <div className="text-[6px] font-mono text-white bg-white/10 py-0.5 rounded border border-white/5 truncate" style={{ fontSize: '4pt' }}>
                  TKN: {user.qr_code || "EMP-001"}
                </div>
              </div>

              {/* Landscape right area in print card */}
              <div className="flex-1 flex flex-col justify-between p-4 bg-white" style={{ padding: '10px' }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-black text-zinc-900 leading-tight tracking-tight" style={{ fontSize: '9pt' }}>
                      {user.first_name} {user.last_name}
                    </h4>
                    {showPosition && (
                      <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider" style={{ fontSize: '6pt' }}>
                        {user.position || "Medical Officer"}
                      </p>
                    )}
                  </div>

                  <div className="w-12 h-12 rounded-full border border-zinc-100 overflow-hidden shrink-0 relative bg-white" style={{ borderColor: selectedTheme.accentColor, width: '40px', height: '40px' }}>
                    {renderAvatarContent()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-dashed border-zinc-200 pt-2 text-[7px] font-mono text-zinc-600" style={{ fontSize: '5pt' }}>
                  <div>
                    <span className="text-zinc-400 block font-bold leading-none uppercase">Emp ID</span>
                    <span className="font-black text-zinc-950 block mt-0.5">{user.employee_no || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block font-bold leading-none uppercase">Department</span>
                    <span className="font-black text-zinc-950 truncate block mt-0.5">{getDeptDisplay()}</span>
                  </div>
                  {showHireDate && (
                    <div>
                      <span className="text-zinc-400 block font-bold leading-none uppercase">Issued</span>
                      <span className="font-black text-zinc-950 block mt-0.5">
                        {user.hire_date ? new Date(user.hire_date).toLocaleDateString() : "Active Duty"}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-400 block font-bold leading-none uppercase">Status</span>
                    <span className="font-bold text-emerald-600 block mt-0.5">Active</span>
                  </div>
                </div>

                {showDisclaimer && (
                  <div className="text-[6px] font-sans text-zinc-400 uppercase tracking-tight pt-1.5 border-t border-zinc-100" style={{ fontSize: '4.5pt', paddingTop: '4px' }}>
                    DGMC DIETARY UNIT • VOUCHER VALID ONLY DURING SHIFTS
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for printing ID Card */}
      <motion.button
        id="print-fab"
        onClick={handlePrint}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl flex items-center justify-center gap-2 group non-printable focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all cursor-pointer border border-teal-500/30"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Print Badge Card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Printer className="w-5.5 h-5.5" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out font-bold text-xs whitespace-nowrap tracking-wide select-none">
          Print ID Card
        </span>
      </motion.button>

      {/* Batch QR Export Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 non-printable overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-zinc-200">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950">Batch QR Codes Export &amp; Printable Sheet</h3>
                  <p className="text-xs text-zinc-500">
                    Showing {batchEmployees.length} active hospital personnel registered for dietary voucher distribution.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Batch PDF</span>
                </button>
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="w-9 h-9 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-700 flex items-center justify-center transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-zinc-100 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {batchEmployees.map((emp) => (
                  <div key={emp.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex items-center gap-4">
                    <div className="w-24 h-24 bg-zinc-100 rounded-xl border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden">
                      <div className="text-[10px] font-mono text-center p-2 text-zinc-600 font-bold">
                        {emp.employee_no || "EMP"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-zinc-900 truncate">{emp.first_name} {emp.last_name}</h4>
                      <p className="text-xs text-zinc-500 font-medium truncate">{emp.position || "Hospital Personnel"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-mono font-bold rounded-md">
                          {emp.employee_no || "ID-N/A"}
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">Token: {emp.qr_code || "Active"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-5 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
