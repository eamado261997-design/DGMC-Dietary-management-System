import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { useLoading } from "../context/LoadingContext.js";
import { motion, AnimatePresence } from "motion/react";
import DGMCLogo from "./DGMCLogo.js";
import DatabaseStatusIndicator from "./DatabaseStatusIndicator.js";
import OfflineIndicatorDot from "./OfflineIndicatorDot.js";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Building,
  BarChart3,
  QrCode,
  CalendarCheck,
  History,
  ShieldAlert,
  ClipboardList,
  Lock,
  LogOut,
  Menu,
  X,
  Stethoscope,
  HeartPulse,
  Settings,
  ChevronRight,
  Home,
  Download
} from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Layout({ children, activeView, onViewChange }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isLoading, progress } = useLoading();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  if (!user) return <>{children}</>;

  // Get view links according to role
  const getMenuItems = (): MenuItem[] => {
    switch (user.role) {
      case "admin":
      case "dietary_admin":
        return [
          { id: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "admin-employees", label: "Manage Employees", icon: Users },
          { id: "admin-users", label: "System Users", icon: ClipboardList },
          { id: "admin-departments", label: "Departments", icon: Building },
          { id: "admin-reports", label: "Reports & Auditing", icon: BarChart3 },
          ...(user.role === "admin" ? [
            { id: "admin-settings", label: "System Settings", icon: Settings },
            { id: "admin-audit-trail", label: "Compliance Audit", icon: ShieldAlert }
          ] : []),
          { id: "change-password", label: "Security & Pass", icon: Lock }
        ];
      case "manager":
        return [
          { id: "manager-dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "manager-schedule", label: "Schedules Manager", icon: CalendarCheck },
          { id: "manager-employees", label: "Department Staff", icon: Users },
          { id: "change-password", label: "Security & Pass", icon: Lock }
        ];
      case "cashier":
        return [
          { id: "cashier-dashboard", label: "Dashboard & Stats", icon: LayoutDashboard },
          { id: "cashier-scan", label: "Scan & Process Menu", icon: QrCode },
          { id: "cashier-transactions", label: "Today's Transactions", icon: History },
          { id: "change-password", label: "Security & Pass", icon: Lock }
        ];
      case "employee":
        return [
          { id: "employee-dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "employee-qr", label: "My QR Badge", icon: QrCode },
          { id: "employee-meals", label: "My Meal Ledger", icon: History },
          { id: "employee-schedule", label: "My Work Schedule", icon: CalendarCheck },
          { id: "change-password", label: "Security & Pass", icon: Lock }
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  const handleLinkClick = (id: string) => {
    onViewChange(id);
    setMobileOpen(false);
  };

  interface BreadcrumbSegment {
    label: string;
    viewId?: string;
  }

  const getBreadcrumbs = (view: string, role: string): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];
    
    // Base portal root based on role
    if (role === "admin") {
      segments.push({ label: "Admin Space", viewId: "admin-dashboard" });
    } else if (role === "dietary_admin") {
      segments.push({ label: "Dietary Admin Space", viewId: "admin-dashboard" });
    } else if (role === "manager") {
      segments.push({ label: "Management Hub", viewId: "manager-dashboard" });
    } else if (role === "cashier") {
      segments.push({ label: "Cafeteria Register", viewId: "cashier-dashboard" });
    } else if (role === "employee") {
      segments.push({ label: "Staff Portal", viewId: "employee-dashboard" });
    } else {
      segments.push({ label: "System Portal" });
    }

    // Active view details
    switch (view) {
      case "admin-dashboard":
      case "manager-dashboard":
      case "employee-dashboard":
      case "cashier-dashboard":
        // Single root level dashboard, no secondary segment needed or keep simple
        break;
      case "admin-employees":
        segments.push({ label: "Manage Employees" });
        break;
      case "admin-users":
        segments.push({ label: "System Users" });
        break;
      case "admin-departments":
        segments.push({ label: "Departments" });
        break;
      case "admin-reports":
        segments.push({ label: "Reports & Auditing" });
        break;
      case "admin-settings":
        segments.push({ label: "System Settings" });
        break;
      case "admin-audit-trail":
        segments.push({ label: "Compliance Audit Trail" });
        break;
      case "manager-schedule":
        segments.push({ label: "Schedules Manager" });
        break;
      case "manager-employees":
        segments.push({ label: "Department Staff" });
        break;
      case "cashier-scan":
        segments.push({ label: "Scan & Process Menu" });
        break;
      case "cashier-transactions":
        segments.push({ label: "Today's Transactions" });
        break;
      case "employee-qr":
        segments.push({ label: "My QR Badge" });
        break;
      case "employee-meals":
        segments.push({ label: "My Meal Ledger" });
        break;
      case "employee-schedule":
        segments.push({ label: "My Work Schedule" });
        break;
      case "change-password":
        segments.push({ label: "Security & Pass" });
        break;
      default:
        // Fallback
        const menuItem = menuItems.find(item => item.id === view);
        if (menuItem) {
          segments.push({ label: menuItem.label });
        }
        break;
    }

    return segments;
  };

  const breadcrumbs = getBreadcrumbs(activeView, user?.role || "");

  return (
    <div id="layout-container" className="min-h-screen bg-zinc-50 flex flex-col font-sans relative">
      {/* Global Progress Bar for Pending Async API Requests */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed top-0 left-0 right-0 z-[9990] h-1.5 bg-teal-950/20 pointer-events-none overflow-hidden"
          >
            {progress !== null ? (
              <motion.div
                className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.9)]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            ) : (
              <motion.div
                className="h-full w-2/5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.95)] rounded-full"
                animate={{
                  x: ["-100%", "280%"]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.1,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Mobile Bar */}
      <header className="lg:hidden h-14 bg-teal-900 border-b border-teal-850 px-4 flex items-center justify-between text-white sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <DGMCLogo variant="icon" />
          <span className="hidden sm:inline text-[10px] font-mono uppercase bg-white/10 text-teal-250 border border-white/5 py-0.5 px-2 rounded-full font-bold truncate">Cafeteria Unit</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OfflineIndicatorDot />
          <DatabaseStatusIndicator />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1 text-teal-100 hover:text-white rounded-lg hover:bg-teal-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex relative">
        {/* Dynamic Nav Sidebar (Desktop & Animated Mobile Overlay) */}
        <aside
          className={`w-64 bg-teal-950 border-r border-teal-900 text-teal-100 flex flex-col fixed inset-y-14 lg:inset-y-0 left-0 z-30 transition-transform transform lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } lg:sticky`}
        >
          {/* Brand Identity / Title Block */}
          <div className="p-5 border-b border-teal-900 hidden lg:flex items-center justify-center bg-teal-950">
            <DGMCLogo variant="white" />
          </div>

          {/* User Profile Summary */}
          <div className="p-4 mx-3 my-4 rounded-xl bg-teal-900/40 border border-teal-900 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-800/80 border border-teal-700 font-mono text-zinc-100 flex items-center justify-center font-bold text-xs select-none">
              {user.first_name?.[0] || user.username?.[0] || 'U'}{user.last_name?.[0] || ''}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">{user.first_name} {user.last_name}</p>
              <p className="text-[10px] text-teal-400 capitalize truncate mt-0.5">{user.role}</p>
            </div>
          </div>

          {/* Nav list */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-teal-500 text-white shadow-md shadow-teal-950/20"
                      : "text-teal-200 hover:bg-teal-900/60 hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-teal-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Sign Out Frame Footer */}
          <div className="p-4 border-t border-teal-900 flex flex-col gap-2 bg-teal-950/40">
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-teal-300 hover:bg-teal-900 hover:text-white bg-teal-900/40 border border-teal-800 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-teal-400" />
                Install Desktop App
              </button>
            )}
            <button
              onClick={logout}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-teal-300 hover:bg-rose-950/30 hover:text-rose-450 transition-all"
            >
              <LogOut className="w-4 h-4 text-teal-400" />
              Sign Out Session
            </button>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-teal-950/40 backdrop-blur-xs z-20 lg:hidden"
          />
        )}

        {/* Primary Viewport Area */}
        <main className="flex-1 min-w-0 bg-zinc-50 p-4 md:p-8 overflow-y-auto flex flex-col">
          {/* Breadcrumb Navigation Component */}
          <div className="mb-6 flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider non-printable select-none">
            <div className="flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-zinc-300 mr-0.5" />
              {breadcrumbs.map((segment, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                const canClick = segment.viewId && segment.viewId !== activeView;
                
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-300 shrink-0" />}
                    {canClick ? (
                      <button
                        type="button"
                        onClick={() => handleLinkClick(segment.viewId!)}
                        className="hover:text-teal-600 transition-colors cursor-pointer text-zinc-400 font-bold uppercase tracking-wider hover:underline"
                      >
                        {segment.label}
                      </button>
                    ) : (
                      <span className={isLast ? "text-zinc-800 font-extrabold" : "text-zinc-400"}>
                        {segment.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <OfflineIndicatorDot />
              <DatabaseStatusIndicator />
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
