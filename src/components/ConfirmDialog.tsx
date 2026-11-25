/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dialog konfirmasi & pemberitahuan internal aplikasi (menggantikan window.confirm & window.alert bawaan browser)
 * sehingga tidak memunculkan judul/notice domain eksternal di browser.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
}

export interface AlertOptions {
  title?: string;
  message: string;
  okText?: string;
  variant?: 'info' | 'warning' | 'error';
}

type DialogState =
  | {
      mode: 'confirm';
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
      variant: 'warning' | 'danger' | 'info';
    }
  | {
      mode: 'alert';
      title: string;
      message: string;
      okText: string;
      variant: 'info' | 'warning' | 'error';
    };

export function useAppDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeWith = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  const confirmDialog = useCallback((options: ConfirmOptions): Promise<boolean> => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'confirm',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Oke',
        cancelText: options.cancelText || 'Batal',
        variant: options.variant || 'warning',
      });
    });
  }, []);

  const alertDialog = useCallback((options: AlertOptions | string): Promise<void> => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }
    const normalized: AlertOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({
        mode: 'alert',
        title: normalized.title || 'Pemberitahuan',
        message: normalized.message,
        okText: normalized.okText || 'Oke',
        variant: normalized.variant || 'info',
      });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWith(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, closeWith]);

  const dialogNode =
    dialog && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
            role="dialog"
            aria-modal="true"
            onClick={() => closeWith(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        dialog.variant === 'danger' || dialog.variant === 'error'
                          ? 'bg-rose-100 text-rose-600'
                          : dialog.variant === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-sky-100 text-sky-600'
                      }`}
                    >
                      {dialog.variant === 'danger' || dialog.variant === 'error' || dialog.variant === 'warning' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : dialog.mode === 'confirm' ? (
                        <HelpCircle className="w-5 h-5" />
                      ) : (
                        <Info className="w-5 h-5" />
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                      {dialog.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => closeWith(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {dialog.message}
                </p>
              </div>

              <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
                {dialog.mode === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => closeWith(false)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      {dialog.cancelText}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeWith(true)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                        dialog.variant === 'danger'
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                          : dialog.variant === 'warning'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                          : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
                      }`}
                    >
                      {dialog.confirmText}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => closeWith(true)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                  >
                    {dialog.okText}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return {
    dialogNode,
    confirmDialog,
    alertDialog,
  };
}
