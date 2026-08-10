import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X, Loader2, HelpCircle } from 'lucide-react';

export type ModalType = 'confirm' | 'danger' | 'warning' | 'info' | 'success' | 'custom';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalOptions {
  id?: string;
  title?: string;
  message?: React.ReactNode;
  content?: React.ReactNode;
  type?: ModalType;
  size?: ModalSize;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  preventDismiss?: boolean;
  isLoading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  customFooter?: React.ReactNode;
}

interface ModalInstance extends ModalOptions {
  id: string;
  type: ModalType;
  size: ModalSize;
  closeOnEsc: boolean;
  closeOnBackdropClick: boolean;
  showCancel: boolean;
  isSubmitting?: boolean;
}

export interface ModalContextType {
  openModal: (
    titleOrOptions: string | ModalOptions,
    message?: React.ReactNode,
    onConfirm?: () => void | Promise<void>,
    options?: Partial<ModalOptions>
  ) => string;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
  confirm: (options: ModalOptions) => string;
  danger: (options: ModalOptions) => string;
  info: (options: ModalOptions) => string;
  warning: (options: ModalOptions) => string;
  success: (options: ModalOptions) => string;
  custom: (options: ModalOptions) => string;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modals, setModals] = useState<ModalInstance[]>([]);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalContainerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Function to add a modal to the stack
  const openModal = useCallback(
    (
      titleOrOptions: string | ModalOptions,
      message?: React.ReactNode,
      onConfirm?: () => void | Promise<void>,
      options?: Partial<ModalOptions>
    ): string => {
      // Save current focused element to restore later
      if (document.activeElement instanceof HTMLElement && modals.length === 0) {
        previousFocusRef.current = document.activeElement;
      }

      let newModal: ModalInstance;
      const generatedId = `modal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      if (typeof titleOrOptions === 'string') {
        newModal = {
          id: options?.id || generatedId,
          title: titleOrOptions,
          message: message,
          onConfirm: onConfirm,
          type: options?.type || 'danger',
          size: options?.size || 'sm',
          confirmLabel: options?.confirmLabel || 'Confirm',
          cancelLabel: options?.cancelLabel || 'Cancel',
          showCancel: options?.showCancel ?? true,
          closeOnEsc: options?.closeOnEsc ?? true,
          closeOnBackdropClick: options?.closeOnBackdropClick ?? true,
          isLoading: options?.isLoading ?? false,
          ...options
        };
      } else {
        const opts = titleOrOptions;
        newModal = {
          id: opts.id || generatedId,
          title: opts.title,
          message: opts.message,
          content: opts.content,
          type: opts.type || 'confirm',
          size: opts.size || 'sm',
          confirmLabel: opts.confirmLabel || 'Confirm',
          cancelLabel: opts.cancelLabel || 'Cancel',
          showCancel: opts.showCancel ?? (opts.type !== 'info' && opts.type !== 'success'),
          closeOnEsc: opts.closeOnEsc ?? !opts.preventDismiss,
          closeOnBackdropClick: opts.closeOnBackdropClick ?? !opts.preventDismiss,
          isLoading: opts.isLoading ?? false,
          ...opts
        };
      }

      setModals((prev) => {
        // Replace modal if same ID exists, else append to stack
        const exists = prev.some((m) => m.id === newModal.id);
        if (exists) {
          return prev.map((m) => (m.id === newModal.id ? newModal : m));
        }
        return [...prev, newModal];
      });

      return newModal.id;
    },
    [modals.length]
  );

  const closeModal = useCallback((id?: string) => {
    setModals((prev) => {
      if (prev.length === 0) return prev;
      const targetId = id || prev[prev.length - 1].id;
      const updated = prev.filter((m) => m.id !== targetId);

      // If closing all modals, restore focus
      if (updated.length === 0 && previousFocusRef.current) {
        setTimeout(() => {
          previousFocusRef.current?.focus();
          previousFocusRef.current = null;
        }, 50);
      }
      return updated;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModals([]);
    if (previousFocusRef.current) {
      setTimeout(() => {
        previousFocusRef.current?.focus();
        previousFocusRef.current = null;
      }, 50);
    }
  }, []);

  // Helpers for specific modal types
  const confirm = useCallback((options: ModalOptions) => openModal({ type: 'confirm', ...options }), [openModal]);
  const danger = useCallback((options: ModalOptions) => openModal({ type: 'danger', ...options }), [openModal]);
  const info = useCallback((options: ModalOptions) => openModal({ type: 'info', showCancel: false, confirmLabel: 'OK', ...options }), [openModal]);
  const warning = useCallback((options: ModalOptions) => openModal({ type: 'warning', ...options }), [openModal]);
  const success = useCallback((options: ModalOptions) => openModal({ type: 'success', showCancel: false, confirmLabel: 'Got it', ...options }), [openModal]);
  const custom = useCallback((options: ModalOptions) => openModal({ type: 'custom', ...options }), [openModal]);

  // Keyboard navigation & Focus management
  useEffect(() => {
    if (modals.length === 0) return;

    const activeModal = modals[modals.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape Key
      if (e.key === 'Escape' && activeModal.closeOnEsc && !activeModal.isSubmitting) {
        e.preventDefault();
        if (activeModal.onCancel) activeModal.onCancel();
        closeModal(activeModal.id);
        return;
      }

      // Handle Focus Trap (Tab & Shift+Tab)
      if (e.key === 'Tab') {
        const container = modalContainerRefs.current.get(activeModal.id);
        if (!container) return;

        const focusables = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals, closeModal]);

  // Focus modal container or default button when active modal changes
  useEffect(() => {
    if (modals.length > 0) {
      const activeModal = modals[modals.length - 1];
      const timer = setTimeout(() => {
        const container = modalContainerRefs.current.get(activeModal.id);
        if (container) {
          const autoFocusEl = container.querySelector<HTMLElement>('[data-autofocus="true"]') ||
            container.querySelector<HTMLElement>('button[data-primary="true"]') ||
            container.querySelector<HTMLElement>('button, input, select, textarea') ||
            container;
          autoFocusEl?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [modals]);

  // Handle confirm action execution
  const handleConfirmAction = async (modal: ModalInstance) => {
    if (!modal.onConfirm) {
      closeModal(modal.id);
      return;
    }

    try {
      setModals((prev) => prev.map((m) => (m.id === modal.id ? { ...m, isSubmitting: true } : m)));
      await modal.onConfirm();
      closeModal(modal.id);
    } catch (err) {
      console.error('[Modal] Error executing confirm action:', err);
      setModals((prev) => prev.map((m) => (m.id === modal.id ? { ...m, isSubmitting: false } : m)));
    }
  };

  const getTypeStyles = (type: ModalType) => {
    switch (type) {
      case 'danger':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-rose-100 text-rose-600 border border-rose-200/60',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500/30'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          iconBg: 'bg-amber-100 text-amber-600 border border-amber-200/60',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs focus:ring-amber-500/30'
        };
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-100 text-emerald-600 border border-emerald-200/60',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500/30'
        };
      case 'info':
        return {
          icon: Info,
          iconBg: 'bg-sky-100 text-sky-600 border border-sky-200/60',
          confirmBtn: 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs focus:ring-sky-500/30'
        };
      case 'confirm':
        return {
          icon: HelpCircle,
          iconBg: 'bg-indigo-100 text-indigo-600 border border-indigo-200/60',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus:ring-indigo-500/30'
        };
      case 'custom':
      default:
        return {
          icon: null,
          iconBg: 'bg-zinc-100 text-zinc-600 border border-zinc-200/60',
          confirmBtn: 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs focus:ring-zinc-500/30'
        };
    }
  };

  const getSizeClasses = (size: ModalSize) => {
    switch (size) {
      case 'sm':
        return 'max-w-sm';
      case 'md':
        return 'max-w-md';
      case 'lg':
        return 'max-w-lg';
      case 'xl':
        return 'max-w-2xl';
      case 'full':
        return 'max-w-[92vw] h-[88vh] max-h-[88vh] flex flex-col';
      default:
        return 'max-w-sm';
    }
  };

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        closeAllModals,
        confirm,
        danger,
        info,
        warning,
        success,
        custom
      }}
    >
      {children}

      <AnimatePresence>
        {modals.map((modal, index) => {
          const isTopModal = index === modals.length - 1;
          const styles = getTypeStyles(modal.type);
          const IconComp = modal.icon || styles.icon;
          const sizeClass = getSizeClasses(modal.size);
          const isBusy = modal.isLoading || modal.isSubmitting;

          return (
            <div
              key={modal.id}
              className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
              style={{ zIndex: 9990 + index * 10 }}
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={() => {
                  if (modal.closeOnBackdropClick && !isBusy && isTopModal) {
                    if (modal.onCancel) modal.onCancel();
                    closeModal(modal.id);
                  }
                }}
                className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs transition-opacity"
              />

              {/* Modal Container */}
              <motion.div
                ref={(el) => {
                  if (el) modalContainerRefs.current.set(modal.id, el);
                  else modalContainerRefs.current.delete(modal.id);
                }}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-busy={isBusy}
                aria-labelledby={modal.title ? `modal-title-${modal.id}` : undefined}
                aria-describedby={modal.message ? `modal-desc-${modal.id}` : undefined}
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{
                  opacity: 1,
                  scale: isTopModal ? 1 : 0.96 - (modals.length - 1 - index) * 0.02,
                  y: isTopModal ? 0 : -((modals.length - 1 - index) * 8)
                }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`relative w-full bg-white rounded-2xl shadow-2xl border border-zinc-200/80 overflow-hidden outline-none ${sizeClass}`}
              >
                {/* Header / Dismiss Button */}
                {!isBusy && (
                  <button
                    onClick={() => {
                      if (modal.onCancel) modal.onCancel();
                      closeModal(modal.id);
                    }}
                    className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors z-10 focus:outline-hidden focus:ring-2 focus:ring-zinc-300"
                    aria-label="Close dialog"
                  >
                    <X className="w-4 h-4 stroke-[2]" />
                  </button>
                )}

                <div className={`p-6 ${modal.size === 'full' ? 'flex-1 overflow-y-auto' : ''}`}>
                  {/* Top Icon Badge (if applicable) */}
                  {IconComp && (
                    <div className="mb-4 flex items-center justify-start">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs ${styles.iconBg}`}>
                        <IconComp className="w-5 h-5 stroke-[2]" />
                      </div>
                    </div>
                  )}

                  {/* Title & Description */}
                  {modal.title && (
                    <h2
                      id={`modal-title-${modal.id}`}
                      className="text-lg font-bold text-zinc-900 tracking-tight mb-2 pr-6"
                    >
                      {modal.title}
                    </h2>
                  )}

                  {modal.message && (
                    <div
                      id={`modal-desc-${modal.id}`}
                      className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-4"
                    >
                      {modal.message}
                    </div>
                  )}

                  {/* Custom Node Content */}
                  {modal.content && <div className="mt-3 text-zinc-700">{modal.content}</div>}
                </div>

                {/* Footer Controls */}
                {modal.customFooter ? (
                  <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100">{modal.customFooter}</div>
                ) : (
                  <div className="px-6 py-4 bg-zinc-50/80 border-t border-zinc-100/80 flex items-center justify-end gap-2.5">
                    {modal.showCancel && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (modal.onCancel) modal.onCancel();
                          closeModal(modal.id);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-200/60 bg-zinc-100 border border-zinc-200/80 transition-all focus:outline-hidden focus:ring-2 focus:ring-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {modal.cancelLabel}
                      </button>
                    )}

                    <button
                      type="button"
                      data-primary="true"
                      disabled={isBusy}
                      onClick={() => handleConfirmAction(modal)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all focus:outline-hidden focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.confirmBtn}`}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        modal.confirmLabel
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within a ModalProvider');
  return context;
};
