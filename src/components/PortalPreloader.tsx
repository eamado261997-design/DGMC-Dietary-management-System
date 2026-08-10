import React, { useState, useEffect } from "react";
import DGMCLogo from "./DGMCLogo.js";
import { useAuth } from "../context/AuthContext.js";
import VitalSignsLoader from "./VitalSignsLoader.js";

export default function PortalPreloader() {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  let branding = {
    companyName: "Divine Grace Medical Center"
  };

  try {
    const auth = useAuth();
    if (auth && auth.branding) {
      branding = auth.branding;
    }
  } catch (e) {
    // Falls back
  }

  const statusMessages = [
    "Establishing secure network handshake...",
    "Verifying digital personnel credentials...",
    "Synchronizing cafeteria roster database...",
    "Fetching current dietary calendar menus...",
    "Querying corporate meal limit quotas...",
    "Mounting real-time auditing listeners...",
    `Loading ${branding.companyName} medical directories...`,
    "Initializing secure terminal..."
  ];

  // Animate progress bar smoothly
  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0; // Seamless loop or holds at 100
        const step = Math.floor(Math.random() * 15) + 5;
        return Math.min(prev + step, 100);
      });
    }, 400);

    return () => clearInterval(progressTimer);
  }, []);

  // Cycle status messages
  useEffect(() => {
    const messageTimer = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % statusMessages.length);
    }, 1500);

    return () => clearInterval(messageTimer);
  }, [statusMessages.length]);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 font-sans select-none relative overflow-hidden">
      {/* Soft geometric grid in the background to convey structure */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f4f4f5_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f5_1px,transparent_1px)] bg-[size:32px_32px] opacity-60"></div>
      
      {/* Decorative top pulse block */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#003299] via-teal-500 to-[#003299] shadow-md"></div>

      <div className="relative max-w-sm w-full bg-white rounded-3xl border border-zinc-150 p-8 shadow-xl flex flex-col items-center text-center">
        {/* Main Logo Display */}
        <div className="mb-6 scale-95 w-full hover:scale-100 transition-transform duration-300">
          <DGMCLogo variant="full" className="shadow-none border-none p-0" />
        </div>

        {/* Animated Heartbeat / Pulse SVG graphic to tie in with clinical medicine */}
        <VitalSignsLoader size="md" color="blue" className="mb-4" />

        {/* Customized Progress Bar */}
        <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-200">
          <div 
            className="h-full bg-gradient-to-r from-[#003299] to-teal-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Percent read-out */}
        <div className="flex justify-between w-full mt-2 text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">
          <span>System Boot</span>
          <span>{progress}%</span>
        </div>

        {/* Micro status diagnostics */}
        <div className="h-6 mt-6 overflow-hidden w-full">
          <p className="text-[10px] font-mono font-black text-[#003299] uppercase tracking-widest leading-none animate-pulse">
            {statusMessages[statusIdx]}
          </p>
        </div>
      </div>

      {/* Trust Signatures */}
      <div className="mt-8 text-center text-[10px] font-sans text-zinc-400 font-medium tracking-wide">
        <span>Dietary & Hospital Cafeteria Core Service</span>
        <span className="mx-2">•</span>
        <span>{branding.companyName} Portal</span>
      </div>
    </div>
  );
}
