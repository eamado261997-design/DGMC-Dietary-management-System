import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.js";
import { useToast } from "../context/ToastContext.js";
import { Clock, ShieldAlert, LogOut, CheckCircle2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const DEFAULT_INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes in ms
const COUNTDOWN_DURATION = 60; // 60 seconds warning

export default function SessionTimeoutHandler() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  
  const [inactivityLimit, setInactivityLimit] = useState(DEFAULT_INACTIVITY_LIMIT);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [showDevTools, setShowDevTools] = useState(false);
  const [timeSinceActivity, setTimeSinceActivity] = useState(0);

  // Keep track of user activity
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      // Only update if warning modal is not currently showing
      if (!showWarning) {
        setLastActivity(Date.now());
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, showWarning]);

  // Handle timer ticks
  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const timePassed = now - lastActivity;
      setTimeSinceActivity(timePassed);

      if (showWarning) {
        setCountdown((prev) => {
          return prev > 0 ? prev - 1 : 0;
        });
      } else if (timePassed >= inactivityLimit) {
        setShowWarning(true);
        setCountdown(COUNTDOWN_DURATION);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, lastActivity, showWarning, inactivityLimit]);

  // Handle logout when countdown reaches zero
  useEffect(() => {
    if (showWarning && countdown === 0 && user) {
      logout();
      setShowWarning(false);
      addToast("Your session has expired due to inactivity. Please sign in again.");
    }
  }, [showWarning, countdown, user, logout, addToast]);

  const handleStayLoggedIn = () => {
    setLastActivity(Date.now());
    setShowWarning(false);
    addToast("Session renewed successfully.");
  };

  const handleLogOutNow = () => {
    logout();
    setShowWarning(false);
    addToast("Logged out successfully.");
  };

  const handleSimulateInactivity = () => {
    // Instantly trigger warning by setting last activity to the past
    setLastActivity(Date.now() - inactivityLimit - 1000);
  };

  const handleSetTestMode = (isTest: boolean) => {
    if (isTest) {
      setInactivityLimit(10 * 1000); // 10 seconds inactivity
      setLastActivity(Date.now());
      addToast("Test mode activated: 10s inactivity limit.");
    } else {
      setInactivityLimit(DEFAULT_INACTIVITY_LIMIT);
      setLastActivity(Date.now());
      addToast("Standard 15m inactivity limit restored.");
    }
  };

  // Do not render anything if no user is authenticated
  if (!user) return null;

  const secondsRemainingInactivity = Math.max(0, Math.ceil((inactivityLimit - timeSinceActivity) / 1000));
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <>
      {/* Dev Session Monitor Widget (Subtle floating developer tool) */}
      <div id="session-dev-tools-container" className="fixed bottom-4 right-4 z-[9990] flex flex-col items-end">
        <AnimatePresence>
          {showDevTools && (
            <motion.div
              id="session-dev-tools-panel"
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xl w-64 text-xs mb-2 text-zinc-700"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-2 font-bold text-zinc-900">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-teal-850">
                  <Zap className="w-3.5 h-3.5 text-teal-700 animate-pulse" />
                  Session Monitor
                </span>
                <button
                  id="btn-hide-dev-tools"
                  onClick={() => setShowDevTools(false)}
                  className="text-zinc-400 hover:text-zinc-650 font-mono text-[10px]"
                >
                  Hide
                </button>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">User Role:</span>
                  <span className="font-bold text-zinc-800 capitalize">{user.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Idle Timer:</span>
                  <span className="font-bold text-zinc-850">
                    {formatTime(Math.floor(timeSinceActivity / 1000))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Timeout Limit:</span>
                  <span className="font-bold text-zinc-850">
                    {formatTime(Math.floor(inactivityLimit / 1000))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Action in:</span>
                  <span className="font-bold text-teal-800">
                    {showWarning ? `Warning (${countdown}s)` : formatTime(secondsRemainingInactivity)}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-zinc-100 space-y-2">
                <button
                  id="btn-simulate-inactivity"
                  onClick={handleSimulateInactivity}
                  className="w-full py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-850 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                >
                  Simulate 15m Inactivity
                </button>
                <div className="flex gap-1.5">
                  <button
                    id="btn-activate-test-mode"
                    onClick={() => handleSetTestMode(true)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                      inactivityLimit < DEFAULT_INACTIVITY_LIMIT
                        ? "bg-teal-50 border-teal-200 text-teal-800"
                        : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50"
                    }`}
                  >
                    Test (10s)
                  </button>
                  <button
                    id="btn-reset-test-mode"
                    onClick={() => handleSetTestMode(false)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
                      inactivityLimit === DEFAULT_INACTIVITY_LIMIT
                        ? "bg-teal-50 border-teal-200 text-teal-800"
                        : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50"
                    }`}
                  >
                    Reset (15m)
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          id="btn-toggle-session-dev-tools"
          onClick={() => setShowDevTools(!showDevTools)}
          className="bg-white hover:bg-zinc-50 border border-zinc-200 shadow-lg px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold text-zinc-650 tracking-wider uppercase transition-all"
        >
          <Clock className="w-3.5 h-3.5 text-teal-700" />
          <span>Session DevTools</span>
        </button>
      </div>

      {/* Stay Logged In Warning Modal */}
      <AnimatePresence>
        {showWarning && (
          <div id="session-timeout-modal-overlay" className="fixed inset-0 bg-zinc-950/65 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              id="session-timeout-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white border border-zinc-150 rounded-3xl shadow-2xl p-6 md:p-8 max-w-sm w-full relative overflow-hidden"
            >
              {/* Top Accent Ring */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-teal-800"></div>

              {/* Pulsing Warning Icon */}
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-600 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>

              {/* Modal Typography */}
              <div className="text-center mb-6">
                <h2 className="text-zinc-900 font-extrabold text-base mb-1.5">Inactivity Session Warning</h2>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  You have been inactive for {inactivityLimit === DEFAULT_INACTIVITY_LIMIT ? "15 minutes" : formatTime(inactivityLimit / 1000)}. For security, you will be automatically logged out in:
                </p>

                {/* Big Beautiful Countdown Timer */}
                <div className="my-4 inline-flex items-center justify-center h-16 px-6 bg-zinc-50 rounded-2xl border border-zinc-150 text-zinc-900">
                  <span className="font-mono font-extrabold text-2xl tracking-wide">
                    00:{countdown < 10 ? `0${countdown}` : countdown}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">
                  seconds remaining
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  id="btn-stay-logged-in"
                  onClick={handleStayLoggedIn}
                  className="w-full h-11 bg-teal-800 hover:bg-teal-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Stay Logged In
                </button>
                <button
                  id="btn-logout-now"
                  onClick={handleLogOutNow}
                  className="w-full h-10 border border-zinc-200 hover:bg-zinc-50 text-zinc-650 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4 text-zinc-400" />
                  Log Out Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
