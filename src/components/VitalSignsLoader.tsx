import React from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";

interface VitalSignsLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: "teal" | "emerald" | "blue" | "zinc";
}

export default function VitalSignsLoader({
  size = "md",
  className = "",
  color = "teal",
}: VitalSignsLoaderProps) {
  // Color configuration
  const colorMap = {
    teal: {
      stroke: "#0d9488", // teal-600
      glow: "rgba(13, 148, 136, 0.4)",
      bg: "rgba(13, 148, 136, 0.08)",
      text: "text-teal-800",
      heart: "text-teal-600 fill-teal-600",
    },
    emerald: {
      stroke: "#059669", // emerald-600
      glow: "rgba(5, 150, 105, 0.4)",
      bg: "rgba(5, 150, 105, 0.08)",
      text: "text-emerald-800",
      heart: "text-emerald-600 fill-emerald-600",
    },
    blue: {
      stroke: "#003299", // custom brand blue
      glow: "rgba(0, 50, 153, 0.4)",
      bg: "rgba(0, 50, 153, 0.08)",
      text: "text-[#003299]",
      heart: "text-[#003299] fill-[#003299]",
    },
    zinc: {
      stroke: "#52525b", // zinc-600
      glow: "rgba(82, 82, 91, 0.3)",
      bg: "rgba(82, 82, 91, 0.08)",
      text: "text-zinc-800",
      heart: "text-zinc-600 fill-zinc-600",
    },
  };

  const selectedColor = colorMap[color] || colorMap.teal;

  // ECG wave paths (adjusted for viewBox="0 0 100 30")
  const ecgPath = "M 0 15 L 20 15 L 25 15 L 28 10 L 32 15 L 38 15 L 41 22 L 45 2 L 49 28 L 52 15 L 58 15 L 63 10 L 68 15 L 100 15";

  if (size === "sm") {
    // Ultra compact size for inline use, e.g. within lists, status cells, buttons
    return (
      <div id="vital-signs-loader-sm" className={`flex items-center gap-1.5 ${className}`}>
        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: selectedColor.bg }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1.05, 1.25, 1, 1] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.12, 0.24, 0.36, 0.48, 1],
            }}
          >
            <Heart className={`w-3 h-3 ${selectedColor.heart}`} />
          </motion.div>
        </div>
        <svg className="w-10 h-4 overflow-visible" viewBox="0 0 100 30" fill="none">
          <path
            d={ecgPath}
            stroke={selectedColor.stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
          />
          <motion.path
            d={ecgPath}
            stroke={selectedColor.stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0px 0px 3px ${selectedColor.stroke})`,
            }}
            initial={{ pathLength: 0, pathOffset: 0 }}
            animate={{
              pathLength: [0.15, 0.3, 0.15],
              pathOffset: [0, 1],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </svg>
      </div>
    );
  }

  // Large full layout (default size md / lg)
  const dimensionsClass = size === "lg" ? "w-24 h-24" : "w-16 h-16";
  const heartSizeClass = size === "lg" ? "w-8 h-8" : "w-5 h-5";
  const ecgWidthClass = size === "lg" ? "w-48 h-12" : "w-36 h-8";

  return (
    <div
      id={`vital-signs-loader-${size}`}
      className={`flex flex-col items-center justify-center gap-3 text-center p-3 select-none ${className}`}
    >
      {/* Central Pulsing Heart Unit */}
      <div className="relative flex items-center justify-center">
        {/* Ring waves */}
        <motion.div
          className={`absolute ${dimensionsClass} rounded-full border border-teal-500/20`}
          animate={{
            scale: [0.9, 1.6],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{ borderColor: selectedColor.stroke }}
        />
        <motion.div
          className={`absolute ${dimensionsClass} rounded-full border-2 border-teal-500/10`}
          animate={{
            scale: [0.9, 2.2],
            opacity: [0.4, 0],
          }}
          transition={{
            duration: 2,
            delay: 0.6,
            repeat: Infinity,
            ease: "easeOut",
          }}
          style={{ borderColor: selectedColor.stroke }}
        />

        {/* Outer Circular Aura Grid */}
        <div 
          className={`${dimensionsClass} rounded-full flex items-center justify-center border-2 border-zinc-100 shadow-sm relative overflow-hidden`}
          style={{ backgroundColor: selectedColor.bg }}
        >
          {/* Heart icon beating in dual rhythm */}
          <motion.div
            className="z-10"
            animate={{
              scale: [1, 1.25, 1.05, 1.25, 1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.12, 0.24, 0.36, 0.48, 1],
            }}
          >
            <Heart className={`${heartSizeClass} ${selectedColor.heart} drop-shadow-[0_2px_4px_rgba(0,0,0,0.06)]`} />
          </motion.div>
        </div>
      </div>

      {/* Real-time CRT ECG Sweep Screen */}
      <div className="relative flex items-center justify-center bg-zinc-950/4 rounded-2xl px-5 py-2.5 border border-zinc-150/40">
        <svg className={`${ecgWidthClass} overflow-visible`} viewBox="0 0 100 30" fill="none">
          {/* Static reference pattern */}
          <path
            d={ecgPath}
            stroke={selectedColor.stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-15"
          />
          {/* Dynamic sweeping sweep beam */}
          <motion.path
            d={ecgPath}
            stroke={selectedColor.stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0px 0px 4px ${selectedColor.stroke})`,
            }}
            initial={{ pathLength: 0, pathOffset: 0 }}
            animate={{
              pathLength: [0.15, 0.3, 0.15],
              pathOffset: [0, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </svg>
      </div>
    </div>
  );
}
