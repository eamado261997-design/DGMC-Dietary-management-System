import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  variant?: "default" | "compact" | "dashed";
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title = "No data available",
  description = "There are no records to display at this time.",
  actionLabel,
  onAction,
  className = "",
  variant = "dashed"
}) => {
  const containerClasses = {
    default: "p-8 bg-zinc-50 border border-zinc-200 rounded-2xl",
    compact: "p-4 bg-zinc-50/50 border border-zinc-100 rounded-xl",
    dashed: "p-8 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/30"
  }[variant];

  return (
    <div
      className={`h-full w-full min-h-[160px] flex flex-col items-center justify-center text-center ${containerClasses} ${className}`}
    >
      <div className="w-10 h-10 rounded-2xl bg-zinc-100/80 text-zinc-400 flex items-center justify-center mb-2.5 shadow-2xs">
        <Icon className="w-5 h-5 stroke-[1.5]" />
      </div>
      <h4 className="text-xs font-bold text-zinc-800 tracking-tight mb-1">
        {title}
      </h4>
      {description && (
        <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-[11px] rounded-xl transition-all shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
