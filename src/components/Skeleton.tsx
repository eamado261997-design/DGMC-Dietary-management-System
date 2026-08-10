import React from "react";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse bg-zinc-200 rounded-md ${className || ""}`} style={style} />
  );
}
