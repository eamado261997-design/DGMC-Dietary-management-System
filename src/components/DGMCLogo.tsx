import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.js";
import dgmcLogoAsset from "../assets/dgmc-logo.png";

interface DGMCLogoProps {
  variant?: "full" | "white" | "compact" | "icon";
  className?: string;
  height?: number | string;
}

export default function DGMCLogo({ variant = "full", className = "", height }: DGMCLogoProps) {
  const [imgError, setImgError] = useState(false);

  let branding = {
    companyName: "Divine Grace Medical Center",
    companyTagline: "Quality care for life",
    currencySymbol: "₱",
    companyLogoUrl: ""
  };

  try {
    const auth = useAuth();
    if (auth && auth.branding) {
      branding = auth.branding;
    }
  } catch (e) {
    // AuthProvider not loaded yet
  }

  const logoSrc = branding.companyLogoUrl || dgmcLogoAsset;

  const handleImageError = () => {
    setImgError(true);
  };

  // 1. Icon variant (For top mobile header or compact headers)
  if (variant === "icon") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-10 px-2 rounded-xl bg-white flex items-center justify-center border border-white/20 shadow-xs shrink-0 overflow-hidden">
          {!imgError ? (
            <img 
              src={logoSrc} 
              alt="DGMC Logo" 
              onError={handleImageError}
              className="h-8 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="font-extrabold text-xs tracking-tight text-[#003299] font-sans uppercase">
              DGMC
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. Compact variant (Form headers, login page welcome block)
  if (variant === "compact") {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <div className="bg-white px-4 py-3 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-center max-w-[300px]">
          {!imgError ? (
            <img 
              src={logoSrc} 
              alt="Divine Grace Medical Center Logo" 
              onError={handleImageError}
              className="h-16 md:h-20 w-auto max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xl font-black text-[#003299] tracking-tight font-sans block">
              DGMC
            </span>
          )}
        </div>
      </div>
    );
  }

  // 3. White / Dark background variant (For dark blue/teal sidebars and login hero)
  if (variant === "white") {
    return (
      <div className={`flex flex-col select-none ${className}`}>
        <div className="bg-white px-4 py-3 rounded-2xl shadow-md border border-white/20 inline-flex items-center justify-center max-w-[300px]">
          {!imgError ? (
            <img 
              src={logoSrc} 
              alt="Divine Grace Medical Center Logo" 
              onError={handleImageError}
              className="h-16 md:h-20 w-auto max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="px-2 py-1">
              <span className="text-lg font-black text-[#003299] tracking-tight font-sans block">
                DGMC
              </span>
              <span className="text-[9px] font-bold text-zinc-600 block uppercase">
                {branding.companyName}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Default / Full brand logo block (Card view, preloader, reports)
  return (
    <div className={`flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl select-none max-w-sm mx-auto shadow-xs border border-zinc-150 ${className}`}>
      <div 
        className="w-full flex items-center justify-center" 
        style={{ height: height || "auto", minHeight: height ? undefined : "80px" }}
      >
        {!imgError ? (
          <div className="flex flex-col items-center">
            <img 
              src={logoSrc} 
              alt="Divine Grace Medical Center Logo" 
              onError={handleImageError}
              className="max-h-24 md:max-h-32 w-auto max-w-full object-contain p-1"
              referrerPolicy="no-referrer"
            />
            <span className="text-[9px] font-bold text-[#003299]/80 uppercase tracking-wider mt-1.5 font-sans">
              A Mount Grace Hospital
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center p-2">
            <span className="text-3xl font-black text-[#003299] tracking-tight font-sans">
              DGMC
            </span>
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider mt-1">
              {branding.companyName}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase mt-0.5">
              A Mount Grace Hospital
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

