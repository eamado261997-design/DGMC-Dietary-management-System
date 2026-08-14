import React, { useState, useEffect } from "react";
import { LoadingProvider } from "./context/LoadingContext.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { ModalProvider } from "./context/ModalContext.js";
import { ToastProvider } from "./context/ToastContext.js";
import Layout from "./components/Layout.js";
import Login from "./pages/Login.js";
import ChangePassword from "./pages/ChangePassword.js";
import PortalPreloader from "./components/PortalPreloader.js";
import NetworkStatusBanner from "./components/NetworkStatusBanner.js";
import SessionTimeoutHandler from "./components/SessionTimeoutHandler.js";

// Admin Views
import AdminDashboard from "./pages/admin/AdminDashboard.js";
import ManageEmployees from "./pages/admin/ManageEmployees.js";
import SystemUsers from "./pages/admin/SystemUsers.js";
import ManageDepartments from "./pages/admin/ManageDepartments.js";
import AdminReports from "./pages/admin/AdminReports.js";
import SystemSettings from "./pages/admin/SystemSettings.js";
import AuditTrail from "./pages/admin/AuditTrail.js";
import DietaryDashboard from "./pages/admin/DietaryDashboard.js";

// Manager Views
import ManagerDashboard from "./pages/manager/ManagerDashboard.js";
import ManagerEmployees from "./pages/manager/ManagerEmployees.js";
import ManagerSchedule from "./pages/manager/ManagerSchedule.js";

// Cashier Views
import CashierDashboard from "./pages/cashier/CashierDashboard.js";
import CashierScan from "./pages/cashier/CashierScan.js";
import CashierTransactions from "./pages/cashier/CashierTransactions.js";

// Employee Views
import EmployeeDashboard from "./pages/employee/EmployeeDashboard.js";
import EmployeeQR from "./pages/employee/EmployeeQR.js";
import EmployeeMeals from "./pages/employee/EmployeeMeals.js";
import EmployeeSchedule from "./pages/employee/EmployeeSchedule.js";

// Main Root Hub
function CoreHubApp() {
  const { user, loading, isRefreshing } = useAuth();
  const [activeView, setActiveView] = useState("login");

  // Dynamically relocate user to landing dashboard when they complete authentication
  useEffect(() => {
    if (user) {
      if (user.role === "admin" || user.role === "dietary_admin") {
        setActiveView("admin-dashboard");
      } else if (user.role === "manager") {
        setActiveView("manager-dashboard");
      } else if (user.role === "cashier") {
        setActiveView("cashier-dashboard");
      } else if (user.role === "employee") {
        setActiveView("employee-dashboard");
      }
    } else {
      setActiveView("login");
    }
  }, [user]);

  if (loading) {
    return <PortalPreloader />;
  }

  // If unauthenticated, show gorgeous clinical lock screen
  if (!user) {
    return <Login />;
  }

  // Render view-pane matching credentials and current navigation tabs
  const renderCurrentView = () => {
    // Client-side access checks preventing unauthorized page visual loads
    const hasAccessToView = (view: string): boolean => {
      if (!user) return false;
      if (user.role === "admin") return true; 

      if (view === "change-password" || view === "login") return true;

      if (user.role === "dietary_admin") {
        return ["admin-dashboard", "admin-employees", "admin-users", "admin-departments", "admin-reports", "change-password"].includes(view);
      }
      if (user.role === "manager") {
        return ["manager-dashboard", "manager-employees", "manager-schedule"].includes(view);
      }
      if (user.role === "cashier") {
        return ["cashier-dashboard", "cashier-scan", "cashier-transactions"].includes(view);
      }
      if (user.role === "employee") {
        return ["employee-dashboard", "employee-qr", "employee-meals", "employee-schedule"].includes(view);
      }
      return false;
    };

    if (!hasAccessToView(activeView)) {
      return (
        <div className="p-8 max-w-md mx-auto my-12 text-center bg-white border border-rose-150 rounded-3xl shadow-sm">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-zinc-950 font-bold font-sans text-base mb-1">Access Restrained</h3>
          <p className="text-zinc-500 text-xs leading-relaxed mb-6">Your network registry does not possess the credentials needed to access this workspace panel.</p>
          <button
            onClick={() => {
              if (user.role === "admin" || user.role === "dietary_admin") setActiveView("admin-dashboard");
              else if (user.role === "manager") setActiveView("manager-dashboard");
              else if (user.role === "cashier") setActiveView("cashier-dashboard");
              else if (user.role === "employee") setActiveView("employee-dashboard");
            }}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (activeView) {
      // Shared Pages
      case "change-password":
        return <ChangePassword />;

      // Administrator Portals
      case "admin-dashboard":
        return user.role === "dietary_admin" ? <DietaryDashboard onViewChange={setActiveView} /> : <AdminDashboard onViewChange={setActiveView} />;
      case "admin-employees":
        return <ManageEmployees />;
      case "admin-users":
        return <SystemUsers />;
      case "admin-departments":
        return <ManageDepartments />;
      case "admin-reports":
        return <AdminReports />;
      case "admin-settings":
        return <SystemSettings />;
      case "admin-audit-trail":
      case "audit-trail":
        return <AuditTrail />;

      // Supervisor Lead Portals
      case "manager-dashboard":
        return <ManagerDashboard onViewChange={setActiveView} />;
      case "manager-employees":
        return <ManagerEmployees />;
      case "manager-schedule":
        return <ManagerSchedule />;

      // Cash register checkout portals
      case "cashier-dashboard":
        return <CashierDashboard onViewChange={setActiveView} />;
      case "cashier-scan":
        return <CashierScan />;
      case "cashier-transactions":
        return <CashierTransactions />;

      // Employee Benefit portals
      case "employee-dashboard":
        return <EmployeeDashboard onViewChange={setActiveView} />;
      case "employee-qr":
        return <EmployeeQR />;
      case "employee-meals":
        return <EmployeeMeals />;
      case "employee-schedule":
        return <EmployeeSchedule />;

      default:
        return (
          <div className="p-8 text-center bg-white border border-zinc-200 rounded-3xl">
            <h3 className="text-zinc-400 font-bold font-sans">Visual panel lookup mismatch.</h3>
          </div>
        );
    }
  };

  return (
    <Layout activeView={activeView} onViewChange={setActiveView}>
      {renderCurrentView()}
      {isRefreshing && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white border border-zinc-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-zinc-900 leading-none">Security Refresh</span>
              <span className="text-[9px] text-zinc-500 font-medium">Re-authenticating session...</span>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// Wrapper preserving core global context values
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Suppress console diagnostics in production
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignored
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 select-none font-sans">
          <div className="w-full max-w-md bg-white border border-zinc-200 shadow-xl rounded-3xl p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-extrabold text-zinc-900 mb-2">Unexpected Runtime Error</h2>
            <p className="text-zinc-500 text-xs leading-relaxed mb-6">
              The application encountered an unexpected state error. Click below to clear local caches and restart the platform fresh.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 bg-zinc-50 border border-zinc-150 rounded-xl text-left font-mono text-[11px] text-zinc-600 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Reset App & Clear Cache
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <LoadingProvider>
          <AuthProvider>
            <ModalProvider>
              <NetworkStatusBanner />
              <SessionTimeoutHandler />
              <CoreHubApp />
            </ModalProvider>
          </AuthProvider>
        </LoadingProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
