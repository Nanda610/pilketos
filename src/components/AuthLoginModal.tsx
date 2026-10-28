/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal & Gate Login untuk Administrator Sekolah dan Panitia Pemilihan OSIS.
 * Memvalidasi autentikasi, mengizinkan pergantian tab peran, autofill demo cepat,
 * dan mencatat riwayat masuk ke audit log.
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  KeyRound, 
  User, 
  Eye, 
  EyeOff, 
  Lock, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight
} from 'lucide-react';
import { UserRole, AuthSession, SchoolConfig } from '../types';
import { electionStore } from '../lib/store';
import { GarudaIcon } from './GarudaIcon';

interface AuthLoginModalProps {
  isOpen: boolean;
  targetRole?: UserRole | null;
  school: SchoolConfig;
  onSuccess: (session: AuthSession) => void;
  onClose: () => void;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  targetRole = 'panitia',
  school,
  onSuccess,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('panitia');
  const [username, setUsername] = useState<string>('panitia');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Sync role when modal opens or targetRole changes
  useEffect(() => {
    if (isOpen) {
      const initialRole = targetRole || 'panitia';
      setSelectedRole(initialRole);
      setUsername(initialRole === 'admin' ? 'admin' : 'panitia');
      setPassword('');
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen, targetRole]);

  if (!isOpen) return null;

  const handleRoleTabChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (role === 'admin') {
      setUsername('admin');
    } else {
      setUsername('panitia');
    }
    setPassword('');
  };

  const handleFillDemo = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
    } else {
      setUsername('panitia');
      setPassword('panitia123');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Harap masukkan nama pengguna dan kata sandi.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const result = electionStore.login(username, password);
      setIsSubmitting(false);

      if (!result.success || !result.session) {
        setErrorMsg(result.message || 'Login gagal. Periksa kembali nama pengguna dan kata sandi.');
        return;
      }

      // Check role compatibility if strict
      if (selectedRole === 'admin' && result.session.role !== 'admin') {
        setErrorMsg('Akun ini adalah Panitia, bukan Administrator Sekolah.');
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(result.session!);
      }, 400);
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/70 overflow-hidden z-10 transition-all transform animate-in zoom-in-95 duration-200"
      >
        {/* Top Decorative Banner */}
        <div className={`p-6 text-white relative transition-colors duration-300 ${
          selectedRole === 'admin'
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900'
            : 'bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-800'
        }`}>
          {/* Subtle pattern */}
          <div className="absolute inset-0 bg-white/5 opacity-40 mix-blend-overlay pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${
              selectedRole === 'admin' 
                ? 'bg-indigo-600/30 border-indigo-400/30 text-amber-300' 
                : 'bg-sky-500/30 border-sky-300/30 text-sky-200'
            }`}>
              {selectedRole === 'admin' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Users className="w-6 h-6" />
              )}
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Autentikasi Petugas
              </span>
              <h2 id="login-modal-title" className="text-xl font-black tracking-tight leading-tight">
                {selectedRole === 'admin' ? 'Login Administrator' : 'Login Panitia OSIS'}
              </h2>
            </div>
          </div>

          <p className="mt-2 text-xs text-white/85 line-clamp-1">
            {school.type} {school.name}
          </p>
        </div>

        {/* Role Selector Segmented Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
            <button
              type="button"
              onClick={() => handleRoleTabChange('panitia')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedRole === 'panitia'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>Panitia Pemilihan</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleTabChange('admin')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin Sekolah</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <div className="font-bold">Login berhasil! Membuka portal...</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="auth-username" 
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Nama Pengguna (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedRole === 'admin' ? 'admin' : 'panitia'}
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label 
                htmlFor="auth-password" 
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50/80 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-indigo-900 hover:bg-indigo-950 active:scale-[0.99]'
                  : 'bg-sky-600 hover:bg-sky-700 active:scale-[0.99]'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Masuk ke {selectedRole === 'admin' ? 'Panel Admin' : 'Portal Panitia'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Autofill Helper Chips */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
              <GarudaIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Akun Bawaan (Klik Cepat Untuk Uji Coba):</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('panitia')}
                className="p-2 text-left bg-sky-50/80 hover:bg-sky-100/90 border border-sky-200/80 rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-[10px] font-bold text-sky-800 flex items-center justify-between">
                  <span>Panitia OSIS</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-sky-200/60 text-sky-900 font-mono">Auto</span>
                </div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                  panitia / panitia123
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo('admin')}
                className="p-2 text-left bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/80 rounded-xl transition-all cursor-pointer group"
              >
                <div className="text-[10px] font-bold text-indigo-900 flex items-center justify-between">
                  <span>Admin Sekolah</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-200/60 text-indigo-900 font-mono">Auto</span>
                </div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                  admin / admin123
                </div>
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer transition-colors"
            >
              Batal & Kembali ke Papan Hitung Cepat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
