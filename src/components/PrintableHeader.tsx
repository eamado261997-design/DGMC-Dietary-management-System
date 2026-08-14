import React from "react";
import DGMCLogo from "./DGMCLogo.js";

interface PrintableHeaderProps {
  title: string;
  meta?: { label: string; value: React.ReactNode }[];
  showLogo?: boolean;
}

export default function PrintableHeader({ title, meta = [], showLogo = true }: PrintableHeaderProps) {
  return (
    <div className="printable-header-wrapper w-full">
      <div className="print-header-brand">
        {showLogo && (
          <div className="printable-header-logo flex items-center justify-center mb-2">
            <DGMCLogo variant="compact" className="h-12 w-auto max-w-[200px] border-none shadow-none bg-transparent" />
          </div>
        )}
        <h1>Divine Grace Medical Center</h1>
        <p>Compassionate Care, Exceptional Service</p>
        <p className="doc-title">{title}</p>
      </div>
      {meta.length > 0 && (
        <div className="print-meta-grid">
          {meta.map((item, index) => (
            <div className="print-meta-item" key={index}>
              <span>{item.label}: </span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
