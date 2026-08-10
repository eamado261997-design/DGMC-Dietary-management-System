import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { LogOut, User, Activity } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <div id="page-header" className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-zinc-150 mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight font-sans">{title}</h1>
        <p className="text-zinc-550 text-sm mt-0.5">{subtitle}</p>
      </div>
      
      <div className="flex items-center gap-4">
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        
        {user && (
          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 py-1.5 px-3 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0 select-none">
              {user.first_name[0]}{user.last_name[0]}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold text-zinc-800 block leading-tight truncate max-w-36">
                {user.first_name} {user.last_name}
              </span>
              <span className="text-[10px] font-mono uppercase bg-teal-50 text-teal-600 px-1.5 py-0.2 rounded border border-teal-100 font-bold block mt-0.5 w-max">
                {user.role}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
