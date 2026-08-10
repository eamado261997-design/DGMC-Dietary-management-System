import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, AlertTriangle, X, RefreshCw, Clock } from "lucide-react";
import VitalSignsLoader from "../components/VitalSignsLoader.js";

export interface LoadingOptions {
  message?: string;
  submessage?: string;
  timeoutMs?: number; // default 12000ms (12s)
  delayMs?: number; // debounce delay before showing overlay, default 200ms
  minDurationMs?: number; // minimum time overlay remains visible once shown, default 400ms
  showProgress?: boolean;
  initialProgress?: number | null;
  onTimeout?: () => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface LoadingContextType {
  isLoading: boolean; // True if any request is active
  isVisible: boolean; // True if global overlay is currently rendered
  loadingMessage: string;
  submessage?: string;
  progress: number | null; // 0 - 100 or null
  error: string | null;
  elapsedSeconds: number;
  startLoading: (messageOrOptions?: string | LoadingOptions) => void;
  stopLoading: () => void;
  setProgress: (progress: number | null) => void;
  setSubmessage: (submessage: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  withLoading: <T>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    options?: string | LoadingOptions
  ) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_DELAY_MS = 200;
const DEFAULT_MIN_DURATION_MS = 400;

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing request safely...");
  const [submessage, setSubmessageState] = useState<string | undefined>("Please do not refresh or close the tab.");
  const [progress, setProgressState] = useState<number | null>(null);
  const [error, setErrorState] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active options ref for current request session
  const optionsRef = useRef<LoadingOptions>({});
  const countRef = useRef(0);
  const shownAtRef = useRef<number | null>(null);

  // Timers
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    delayTimerRef.current = null;
    minDurationTimerRef.current = null;
    timeoutTimerRef.current = null;
    elapsedIntervalRef.current = null;
  }, []);

  const setProgress = useCallback((val: number | null) => {
    if (val === null) {
      setProgressState(null);
    } else {
      const clamped = Math.max(0, Math.min(100, Math.round(val)));
      setProgressState(clamped);
    }
  }, []);

  const setSubmessage = useCallback((msg: string) => {
    setSubmessageState(msg);
  }, []);

  const setError = useCallback((err: string | null) => {
    setErrorState(err);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const startLoading = useCallback((messageOrOptions?: string | LoadingOptions) => {
    let opts: LoadingOptions = {};
    if (typeof messageOrOptions === "string") {
      opts = { message: messageOrOptions };
    } else if (messageOrOptions) {
      opts = messageOrOptions;
    }

    optionsRef.current = {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      delayMs: DEFAULT_DELAY_MS,
      minDurationMs: DEFAULT_MIN_DURATION_MS,
      ...opts
    };

    const msg = opts.message || "Processing request safely...";
    const sub = opts.submessage || "Please do not refresh or close the tab.";
    const initProg = opts.initialProgress !== undefined ? opts.initialProgress : (opts.showProgress ? 0 : null);

    setLoadingMessage(msg);
    setSubmessageState(sub);
    setProgressState(initProg);
    setErrorState(null);

    // If starting fresh (first request)
    if (countRef.current === 0) {
      setElapsedSeconds(0);
      const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
      const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      // Start elapsed seconds counter
      const startTime = Date.now();
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 500);

      // Debounce timer before showing overlay
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      delayTimerRef.current = setTimeout(() => {
        if (countRef.current > 0) {
          setIsVisible(true);
          shownAtRef.current = Date.now();
        }
      }, delayMs);

      // Timeout timer to prevent infinite loading state
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        if (countRef.current > 0) {
          const timeoutErrMsg = `Request timeout after ${Math.round(timeoutMs / 1000)} seconds. Operation took longer than expected.`;
          setErrorState(timeoutErrMsg);
          setIsVisible(true); // Ensure overlay opens to show timeout warning
          if (optionsRef.current.onTimeout) {
            optionsRef.current.onTimeout();
          }
        }
      }, timeoutMs);
    }

    countRef.current += 1;
    setActiveRequests(countRef.current);
  }, []);

  const stopLoading = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    setActiveRequests(countRef.current);

    if (countRef.current === 0) {
      // Clear elapsed interval & timeout timer
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

      // If debounce timer hasn't fired yet, cancel it (fast request, no overlay flash)
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }

      const minDuration = optionsRef.current.minDurationMs ?? DEFAULT_MIN_DURATION_MS;

      // Calculate how long overlay has been visible to respect minDuration
      if (shownAtRef.current !== null) {
        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, minDuration - elapsed);

        if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
        minDurationTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          shownAtRef.current = null;
          setErrorState(null);
          setProgressState(null);
        }, remaining);
      } else {
        setIsVisible(false);
        setErrorState(null);
        setProgressState(null);
      }
    }
  }, []);

  const forceDismiss = useCallback(() => {
    countRef.current = 0;
    setActiveRequests(0);
    setIsVisible(false);
    setErrorState(null);
    setProgressState(null);
    clearAllTimers();
    if (optionsRef.current.onCancel) {
      optionsRef.current.onCancel();
    }
  }, [clearAllTimers]);

  const withLoading = useCallback(
    async <T,>(
      promiseOrFn: Promise<T> | (() => Promise<T>),
      options?: string | LoadingOptions
    ): Promise<T> => {
      startLoading(options);
      try {
        const promise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
        return await promise;
      } catch (err: any) {
        const errorMessage = err?.message || "An unexpected request error occurred.";
        setErrorState(errorMessage);
        if (typeof options === "object" && options?.onError) {
          options.onError(err instanceof Error ? err : new Error(errorMessage));
        }
        throw err;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const isLoading = activeRequests > 0;

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        isVisible,
        loadingMessage,
        submessage,
        progress,
        error,
        elapsedSeconds,
        startLoading,
        stopLoading,
        setProgress,
        setSubmessage,
        setError,
        clearError,
        withLoading
      }}
    >
      {children}

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isVisible && (
          <div className="fixed inset-0 z-[9980] flex items-center justify-center p-4 sm:p-6 select-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Box */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-live="polite"
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-200/80 p-6 overflow-hidden outline-none"
            >
              {/* Close / Dismiss button (visible during error/timeout or slow requests) */}
              {(error || elapsedSeconds > 5) && (
                <button
                  type="button"
                  onClick={forceDismiss}
                  className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors focus:outline-hidden"
                  aria-label="Dismiss loading overlay"
                >
                  <X className="w-4 h-4 stroke-[2]" />
                </button>
              )}

              {error ? (
                /* Timeout or Exception Display */
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200/80 flex items-center justify-center mb-4 shadow-2xs">
                    <AlertTriangle className="w-6 h-6 stroke-[2]" />
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 tracking-tight mb-1">
                    Request Timeout / Failure
                  </h3>

                  <p className="text-xs text-rose-700 font-medium bg-rose-50 border border-rose-100 rounded-xl p-3 mb-5 leading-relaxed text-left w-full">
                    {error}
                  </p>

                  <div className="flex items-center justify-center gap-2.5 w-full">
                    <button
                      type="button"
                      onClick={forceDismiss}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 transition-all focus:outline-hidden"
                    >
                      Dismiss & Continue
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Progress / Spinner Display */
                <div className="flex flex-col items-center text-center">
                  {/* Glowing ECG/Pulse Vital Signs Loader */}
                  <VitalSignsLoader size="lg" color="teal" className="mb-3" />

                  <h3 className="text-base font-bold text-zinc-900 tracking-tight mb-1">
                    {loadingMessage}
                  </h3>

                  {submessage && (
                    <p className="text-xs text-zinc-500 font-normal leading-relaxed mb-4">
                      {submessage}
                    </p>
                  )}

                  {/* Progress Bar (if active) */}
                  {progress !== null && (
                    <div className="w-full space-y-1.5 mb-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 px-0.5">
                        <span>Progress</span>
                        <span className="font-mono">{progress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/60 p-0.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-zinc-800 to-zinc-950 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Elapsed Timer Indicator */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-zinc-50 px-3 py-1 rounded-full border border-zinc-100">
                    <Clock className="w-3 h-3 stroke-[2] text-zinc-400" />
                    <span>Elapsed: {elapsedSeconds}s</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useLoading must be used within a LoadingProvider");
  return context;
};
