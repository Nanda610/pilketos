/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal & Generator Kode Semat (Embed) & Template Tema XML untuk Google Blogger / Blogspot.
 * Menyediakan kode iframe untuk postingan/gadget, template tema XML valid (<b:skin>) untuk menu Tema,
 * pembagian langsung (BlogThis!), dan panduan solusi Error 400 "skin pada tema: 0".
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Copy, Check, ExternalLink, Share2, Code2, Sparkles, 
  HelpCircle, Eye, Monitor, Smartphone, Layers, CheckCircle2,
  BookOpen, ArrowRight, ShieldCheck, Vote, BarChart3, AlertTriangle, FileCode
} from 'lucide-react';
import { BloggerIcon } from './BloggerIcon';

interface ShareBloggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  periodName: string;
}

type EmbedView = 'PUBLIC' | 'BOOTH';
type EmbedHeight = '650px' | '800px' | '1000px';

export const ShareBloggerModal: React.FC<ShareBloggerModalProps> = ({
  isOpen,
  onClose,
  schoolName,
  periodName,
}) => {
  const [selectedView, setSelectedView] = useState<EmbedView>('PUBLIC');
  const [selectedHeight, setSelectedHeight] = useState<EmbedHeight>('800px');
  const [skipIntro, setSkipIntro] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'embed' | 'theme_xml' | 'direct' | 'guide' | 'preview'>('embed');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedThemeXml, setCopiedThemeXml] = useState(false);
  const [guideStep, setGuideStep] = useState<'update_gagal' | 'theme_error' | 'post' | 'gadget' | 'page'>('update_gagal');

  const [customUrl, setCustomUrl] = useState<string>('');

  // Compute actual base URL from custom input, browser, or fallback
  const baseUrl = useMemo(() => {
    if (customUrl && customUrl.trim() !== '') {
      let trimmed = customUrl.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = `https://${trimmed}`;
      }
      return trimmed.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return 'https://epilketos-digital.sch.id';
  }, [customUrl]);

  // Compute target URL based on options
  const targetUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedView !== 'PUBLIC') {
      params.set('view', selectedView);
    }
    if (skipIntro) {
      params.set('autostart', '1');
    }
    const qs = params.toString();
    return qs ? `${baseUrl}/?${qs}` : baseUrl;
  }, [baseUrl, selectedView, skipIntro]);

  // Safe URL for XML / XHTML parsers (& must be escaped as &amp; to prevent "Update Gagal" in Blogger)
  const xmlSafeUrl = useMemo(() => {
    return targetUrl.replace(/&/g, '&amp;');
  }, [targetUrl]);

  // Pre-formatted post title for Blogger
  const postTitle = useMemo(() => {
    return selectedView === 'BOOTH'
      ? `Bilik Suara E-Voting Pemilihan Ketua OSIS ${schoolName}`
      : `Hasil Quick Count Pemilihan Ketua OSIS ${schoolName} (Real-Time Live)`;
  }, [schoolName, selectedView]);

  // Pre-formatted snippet description for Blogger
  const postSnippet = useMemo(() => {
    return `Saksikan perolehan suara pemilihan Ketua & Wakil Ketua OSIS ${schoolName} periode ${periodName} secara langsung, transparan, dan real-time. Klik tautan berikut untuk memantau perolehan suara secara langsung: ${targetUrl}`;
  }, [schoolName, periodName, targetUrl]);

  // Format 1: Ultra-Clean 1-Line Pure Iframe (Zero CSS wrappers, 100% immune to Blogger "Update Gagal" sanitizers)
  const minimalIframeSnippet = useMemo(() => {
    return `<iframe src="${xmlSafeUrl}" width="100%" height="${selectedHeight.replace('px', '')}" frameborder="0" style="width:100%;height:${selectedHeight};border:none;" allowfullscreen="true" allow="clipboard-write; fullscreen" loading="lazy" title="E-Pilketos ${schoolName}"></iframe>`;
  }, [xmlSafeUrl, selectedHeight, schoolName]);

  // Format 2: Styled Container Embed Code
  const embedCodeSnippet = useMemo(() => {
    return `<div style="position:relative; width:100%; max-width:1200px; margin:20px auto; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1); border:1px solid #e2e8f0; background:#f8fafc;">
  <div style="padding:10px 16px; background:#0f172a; color:#ffffff; font-family:sans-serif; font-size:12px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
    <span>🗳️ E-Pilketos Digital · ${schoolName}</span>
    <span style="color:#38bdf8;">🔴 Real-Time Terhubung</span>
  </div>
  <iframe src="${xmlSafeUrl}" width="100%" height="${selectedHeight}" style="border:none; display:block; width:100%; height:${selectedHeight};" allow="clipboard-write; fullscreen" allowfullscreen="true" loading="lazy" title="E-Pilketos Digital ${schoolName}"></iframe>
</div>`;
  }, [schoolName, xmlSafeUrl, selectedHeight]);

  // Complete 100% Valid Blogger XML Template for Theme -> Edit HTML
  // Solves "Seharusnya ada satu dan hanya satu skin pada tema, dan kami menemukan: 0. Error 400"
  // Solves "sb0CZ1... widget tokens" by including mandatory <b:includable id='main'> inside <b:widget>
  // Solves "Update gagal" by escaping & as &amp;
  const themeXmlSnippet = useMemo(() => {
    return `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:defaultmarkups='false' b:layoutsVersion='3' b:responsive='true' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
  <meta content='width=device-width, initial-scale=1, maximum-scale=1' name='viewport'/>
  <title><data:blog.pageTitle/></title>
  
  <!-- TAG WAJIB BLOGGER: b:skin (Mencegah Error 400 & Lolos Validasi Blogger XML) -->
  <b:skin><![CDATA[
    /*-----------------------------------------------
    Blogger Theme XML Resmi E-Pilketos Digital
    100% Valid Tanpa Error 400 & Tanpa Kode Kode sb0CZ1...
    -----------------------------------------------*/
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #epilketos-fullscreen-frame {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      border: 0;
      z-index: 999999;
      display: block;
    }
    .blogger-system-container {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
    }
  ]]></b:skin>
</head>
<body>
  <!-- Frame Aplikasi E-Pilketos Real-Time Layar Penuh -->
  <iframe id='epilketos-fullscreen-frame' src='${xmlSafeUrl}' allow='clipboard-write; fullscreen; camera; microphone' allowfullscreen='true' loading='lazy' title='E-Pilketos Digital ${schoolName}'></iframe>

  <!-- Section wajib arsitektur Blogger (dengan includable id=main wajib agar tidak muncul kode sb0CZ1...) -->
  <div class='blogger-system-container'>
    <b:section id='main' showaddelement='no'>
      <b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog' version='2' visible='false'>
        <b:includable id='main'>
          <data:defaultTitle/>
        </b:includable>
      </b:widget>
    </b:section>
  </div>
</body>
</html>`;
  }, [schoolName, xmlSafeUrl]);

  const [embedStyle, setEmbedStyle] = useState<'minimal' | 'card'>('minimal');
  const [copiedMinimal, setCopiedMinimal] = useState(false);

  const activeSnippet = embedStyle === 'minimal' ? minimalIframeSnippet : embedCodeSnippet;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyMinimalDirect = async () => {
    try {
      await navigator.clipboard.writeText(minimalIframeSnippet);
      setCopiedMinimal(true);
      setTimeout(() => setCopiedMinimal(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyThemeXml = async () => {
    try {
      await navigator.clipboard.writeText(themeXmlSnippet);
      setCopiedThemeXml(true);
      setTimeout(() => setCopiedThemeXml(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Direct share to Blogger "BlogThis" endpoint
  const handleShareToBloggerPost = () => {
    const bloggerShareUrl = `https://www.blogger.com/blog-this.g?u=${encodeURIComponent(
      targetUrl
    )}&n=${encodeURIComponent(postTitle)}&t=${encodeURIComponent(postSnippet)}`;
    
    window.open(bloggerShareUrl, '_blank', 'noopener,noreferrer,width=800,height=650');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl rounded-3xl glass-card border border-white/60 bg-white text-slate-900 shadow-2xl overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200/80 bg-gradient-to-r from-orange-50 via-amber-50 to-sky-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FF5722] text-white flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
                <BloggerIcon size={26} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Bagikan & Pasang di Blogger
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500/15 text-orange-700 border border-orange-500/30">
                    Blogspot
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solusi mudah integrasi ke postingan, gadget, maupun template tema Blogger tanpa error
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
              aria-label="Tutup Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-slate-200 px-4 sm:px-6 pt-3 gap-1.5 sm:gap-2 bg-slate-50/70 text-xs font-bold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('embed')}
              className={`pb-3 px-3 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'embed'
                  ? 'border-orange-500 text-orange-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>1. Kode Postingan / Gadget</span>
            </button>

            <button
              onClick={() => setActiveTab('theme_xml')}
              className={`pb-3 px-3 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'theme_xml'
                  ? 'border-purple-600 text-purple-700 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-purple-600" />
              <span>2. Template Tema XML (Bebas Error 400)</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`pb-3 px-3 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'guide'
                  ? 'border-rose-500 text-rose-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>3. Solusi &ldquo;Update Gagal&rdquo; & Panduan</span>
            </button>

            <button
              onClick={() => setActiveTab('direct')}
              className={`pb-3 px-3 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'direct'
                  ? 'border-orange-500 text-orange-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>4. BlogThis!</span>
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-3 px-3 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'preview'
                  ? 'border-orange-500 text-orange-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>5. Simulasi</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* NOTICE CALLOUT: Penjelasan Error Update Gagal & Error 400 Blogger */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200/80 text-xs space-y-2">
              <div className="flex items-center gap-2 font-black text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Solusi Cepat Error: &ldquo;Update Gagal&rdquo; atau &ldquo;Skin pada tema: 0 (Error 400)&rdquo;</span>
              </div>
              <p className="leading-relaxed text-slate-700">
                Blogger menolak penyimpanan (<strong>Update Gagal</strong>) terutama karena:
                <strong> (1)</strong> Menempelkan kode iframe biasa ke dalam menu <em>Tema &rarr; Edit HTML</em> bukannya di <em>Postingan</em>,
                <strong> (2)</strong> Masih berada di mode <em>Tampilan Menulis (Pena)</em> bukannya <em>Tampilan HTML (&lt;&gt;)</em>, atau
                <strong> (3)</strong> Karakter <code>&amp;</code> pada URL belum di-encode untuk parser Blogger.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-semibold">
                <button
                  onClick={handleCopyMinimalDirect}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMinimal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Salin Iframe 1-Baris (Anti Update Gagal)</span>
                </button>
                <button
                  onClick={() => { setActiveTab('guide'); setGuideStep('update_gagal'); }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                >
                  &rarr; Baca Solusi &ldquo;Update Gagal&rdquo;
                </button>
                <button
                  onClick={() => setActiveTab('theme_xml')}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white transition-colors cursor-pointer"
                >
                  &rarr; Jika Menggunakan Menu Tema (XML Lengkap)
                </button>
              </div>
            </div>

            {/* TAB 1: KODE SEMAT POSTINGAN / GADGET */}
            {activeTab === 'embed' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-sky-900 mb-0.5">
                      📍 Rekomendasi Paling Mudah & Aman (100% Anti Update Gagal):
                    </p>
                    <p className="text-slate-600">
                      Buka dasbor Blogger &rarr; <strong>Postingan Baru</strong> &rarr; klik ikon pensil &rarr; pilih <strong>Tampilan HTML &lt;&gt;</strong> &rarr; Tempel (Paste) kode di bawah.
                    </p>
                  </div>
                </div>

                {/* Custom Domain Input Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                      <span>URL Domain Aplikasi Live (Opsional):</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      (Blogger HTTPS mewajibkan iframe HTTPS)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder={baseUrl}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400"
                    />
                    {customUrl && (
                      <button
                        onClick={() => setCustomUrl('')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reset URL
                      </button>
                    )}
                  </div>
                </div>

                {/* Customization Options Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  {/* Option 1: View Target */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Pilihan Halaman:
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setSelectedView('PUBLIC')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                          selectedView === 'PUBLIC'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Quick Count</span>
                      </button>

                      <button
                        onClick={() => setSelectedView('BOOTH')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1 ${
                          selectedView === 'BOOTH'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Vote className="w-3.5 h-3.5" />
                        <span>Bilik Suara</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Height Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Tinggi Bingkai Frame:
                    </label>
                    <div className="flex gap-1.5">
                      {(['650px', '800px', '1000px'] as EmbedHeight[]).map((h) => (
                        <button
                          key={h}
                          onClick={() => setSelectedHeight(h)}
                          className={`flex-1 py-1.5 px-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            selectedHeight === h
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {h === '650px' ? 'Sedang' : h === '800px' ? 'Tinggi' : 'Penuh'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 3: Autostart Toggle */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Perilaku Pemuatan:
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={skipIntro}
                        onChange={(e) => setSkipIntro(e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                      <span>Langsung Masuk (Lewati Intro)</span>
                    </label>
                  </div>
                </div>

                {/* Format Selector: Minimal (Anti-Gagal) vs Styled Card */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                  <span className="font-extrabold text-slate-700 ml-1">Pilih Format Kode:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEmbedStyle('minimal')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        embedStyle === 'minimal'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      ✓ 1-Baris Murni (Anti Update Gagal)
                    </button>
                    <button
                      onClick={() => setEmbedStyle('card')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        embedStyle === 'card'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Format Berbingkai Kartu
                    </button>
                  </div>
                </div>

                {/* HTML Code Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-orange-600" />
                      {embedStyle === 'minimal' ? 'Kode Iframe 1-Baris (Direkomendasikan agar tidak terjadi Update Gagal):' : 'Kode Embed Berbingkai Kartu:'}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold transition-all shadow-md shadow-orange-600/20 active:scale-95 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Tersalin ke Clipboard!' : 'Salin Kode'}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-4 rounded-2xl bg-slate-900 text-sky-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner max-h-56">
                      {activeSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TEMPLATE TEMA XML (KHUSUS MENU TEMA) */}
            {activeTab === 'theme_xml' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-purple-900">
                    <FileCode className="w-4 h-4 text-purple-600" />
                    <span>Template XML Khusus Menu: Tema &rarr; Edit HTML</span>
                  </div>
                  <p className="leading-relaxed text-slate-700">
                    Kode di bawah ini adalah <strong>Template Tema Blogger Lengkap (XML)</strong> yang sudah menyertakan tag wajib <code>&lt;b:skin&gt;</code>, <code>&lt;b:section&gt;</code>, dan seluruh URL parameter sudah di-encode dengan aman (<code>&amp;amp;</code>).
                    Kode ini <strong>dijamin 100% lolos validasi Blogger tanpa Error 400 dan tanpa Update Gagal</strong>!
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-purple-600" />
                      Kode Template Tema XML (Bebas Error 400 & Bebas Update Gagal):
                    </span>
                    <button
                      onClick={handleCopyThemeXml}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold transition-all shadow-md shadow-purple-700/20 active:scale-95 cursor-pointer"
                    >
                      {copiedThemeXml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedThemeXml ? 'XML Tema Tersalin!' : 'Salin Template Tema XML'}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner max-h-60">
                      {themeXmlSnippet}
                    </pre>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                  <strong className="text-slate-900 block mb-1">Langkah Memasang Template Tema (Bebas Update Gagal):</strong>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>Buka menu <strong className="text-slate-900">Tema (Theme)</strong> di Blogger.</li>
                    <li>Klik tanda panah ke bawah (dropdown) di sebelah tombol &ldquo;Sesuaikan&rdquo; &rarr; pilih <strong className="text-slate-900">Edit HTML</strong>.</li>
                    <li><strong>PENTING:</strong> Tekan <code>Ctrl + A</code> lalu <code>Backspace/Delete</code> untuk <strong>menghapus seluruh kode lama</strong> sampai kosong bersih.</li>
                    <li>Tempelkan (Paste) seluruh kode XML di atas, lalu klik tombol <strong className="text-purple-700">Simpan (Ikon Disket)</strong> di pojok kanan atas.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 3: PANDUAN LANGKAH DEMI LANGKAH */}
            {activeTab === 'guide' && (
              <div className="space-y-4">
                {/* Method Selector */}
                <div className="flex gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200 overflow-x-auto">
                  <button
                    onClick={() => setGuideStep('update_gagal')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      guideStep === 'update_gagal'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🚨 Solusi &ldquo;Update Gagal&rdquo;
                  </button>
                  <button
                    onClick={() => setGuideStep('theme_error')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      guideStep === 'theme_error'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Solusi Error 400
                  </button>
                  <button
                    onClick={() => setGuideStep('post')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      guideStep === 'post'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    1. Di Postingan Baru
                  </button>
                  <button
                    onClick={() => setGuideStep('gadget')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      guideStep === 'gadget'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2. Di Widget / Tata Letak
                  </button>
                  <button
                    onClick={() => setGuideStep('page')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      guideStep === 'page'
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    3. Di Halaman Khusus
                  </button>
                </div>

                {guideStep === 'update_gagal' && (
                  <div className="space-y-4 text-xs text-slate-700 bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
                    <h4 className="font-extrabold text-sm text-rose-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Solusi Mengatasi &ldquo;Update Gagal&rdquo; Saat Memasukkan Kode ke Blogger
                    </h4>
                    
                    <p className="leading-relaxed">
                      Pesan peringatan merah <strong>&ldquo;Update gagal&rdquo;</strong> di Blogger muncul karena 3 kemungkinan berikut. Ikuti solusi sesuai menu tempat Anda memasukkan kode:
                    </p>

                    <div className="space-y-3">
                      {/* Case 1 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-extrabold text-slate-900 block text-xs mb-1">
                          1️⃣ Jika Error Muncul di Menu: Tema &rarr; Edit HTML
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed text-[11px]">
                          <li><strong>Penyebab:</strong> Anda menempelkan kode iframe biasa ke dalam editor tema XML, ATAU ada sisa kode lama yang tercampur.</li>
                          <li><strong>Solusi Pasti:</strong> Buka tab <strong>2. Template Tema XML</strong> di atas. Salin seluruh kode XML tersebut. Pada editor Tema Blogger, tekan <code>Ctrl + A</code> lalu <code>Hapus (Delete)</code> seluruh isi lama sampai kosong, baru <code>Paste</code> kode XML baru kami, lalu klik ikon <strong>Simpan</strong>.</li>
                        </ul>
                      </div>

                      {/* Case 2 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-extrabold text-slate-900 block text-xs mb-1">
                          2️⃣ Jika Error Muncul di Menu: Postingan Baru
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed text-[11px]">
                          <li><strong>Penyebab:</strong> Editor masih dalam mode <em>&ldquo;Tampilan Menulis&rdquo;</em> (ikon Pensil) saat kode ditempelkan, atau tema Blogger Anda memblokir style wrapper div yang terlalu panjang.</li>
                          <li><strong>Solusi Pasti:</strong> Klik ikon pensil di pojok kiri atas bilah alat postingan &rarr; pilih <strong>&lt;&gt; Tampilan HTML</strong>. Kemudian gunakan tombol hijau <strong>&ldquo;Salin Iframe 1-Baris (Anti Update Gagal)&rdquo;</strong> di atas, lalu klik Publikasikan.</li>
                        </ul>
                      </div>

                      {/* Case 3 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="font-extrabold text-slate-900 block text-xs mb-1">
                          3️⃣ Jika Error Muncul di Menu: Tata Letak (Layout)
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed text-[11px]">
                          <li><strong>Penyebab:</strong> Salah memilih tipe gadget (misalnya memilih gadget &ldquo;Teks&rdquo; bukannya &ldquo;HTML/JavaScript&rdquo;).</li>
                          <li><strong>Solusi Pasti:</strong> Klik <em>+ Tambahkan Gadget</em> &rarr; pilih <strong>HTML/JavaScript</strong> &rarr; tempelkan kode iframe 1-baris pada kolom Konten &rarr; klik Simpan.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {guideStep === 'theme_error' && (
                  <div className="space-y-3.5 text-xs text-slate-700 bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
                    <h4 className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Penjelasan & Solusi Lengkap Error 400 (skin pada tema: 0)
                    </h4>
                    <p className="leading-relaxed">
                      Pesan error <em>&ldquo;Seharusnya ada satu dan hanya satu skin pada tema, dan kami menemukan: 0&rdquo;</em> muncul dari sistem Blogger karena kode ditempelkan di tempat yang salah:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
                        <strong className="block text-rose-800 mb-1">❌ Kesalahan Yang Terjadi:</strong>
                        <p className="text-[11px] leading-relaxed">
                          Kode iframe ditempelkan pada menu <strong>Tema &rarr; Edit HTML</strong>. Menu ini hanya menerima dokumen XML Blogger lengkap yang memiliki tag <code>&lt;b:skin&gt;</code>.
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <strong className="block text-emerald-800 mb-1">✅ 2 Solusi Yang Tersedia:</strong>
                        <p className="text-[11px] leading-relaxed">
                          <strong>Solusi A:</strong> Buka tab <em>1. Kode Postingan / Gadget</em>, lalu tempel di menu <strong>Postingan Baru</strong> atau <strong>Tata Letak</strong>.<br/>
                          <strong>Solusi B:</strong> Jika tetap ingin di menu Tema, buka tab <em>2. Template Tema XML</em> di atas.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {guideStep === 'post' && (
                  <div className="space-y-3.5 text-xs text-slate-700 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-black">1</span>
                      Cara Memasang di Postingan Artikel Blogger (Anti Update Gagal):
                    </h4>
                    <ol className="list-decimal list-inside space-y-2.5 ml-1 leading-relaxed">
                      <li>Buka situs <strong className="text-slate-900">Blogger.com</strong> dan masuk ke dasbor blog sekolah Anda.</li>
                      <li>Klik tombol <strong className="text-slate-900">+ Postingan Baru</strong> di pojok kiri atas.</li>
                      <li>Di pojok kiri atas bilah alat editor (sebelah tombol Undo), klik ikon pensil lalu pilih <strong className="text-orange-600 font-bold">&lt;&gt; Tampilan HTML</strong>.</li>
                      <li>Salin kode embed dari tab <em>1. Kode Postingan / Gadget</em> di atas (pilih <em>Format 1-Baris Murni</em>), lalu tempelkan (Paste) di dalam kotak teks HTML tersebut.</li>
                      <li>Beri judul postingan, misalnya: <em className="text-slate-900 font-medium">&ldquo;Hasil Suara Pilketos Real-Time SMP 2026/2027&rdquo;</em>.</li>
                      <li>Klik <strong className="text-slate-900">Publikasikan</strong>. Aplikasi E-Pilketos kini tampil langsung di dalam postingan blog Anda tanpa error!</li>
                    </ol>
                  </div>
                )}

                {guideStep === 'gadget' && (
                  <div className="space-y-3.5 text-xs text-slate-700 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-black">2</span>
                      Cara Memasang di Tata Letak (Sidebar / Gadget Blog):
                    </h4>
                    <ol className="list-decimal list-inside space-y-2.5 ml-1 leading-relaxed">
                      <li>Buka menu <strong className="text-slate-900">Tata Letak (Layout)</strong> pada menu samping kiri dasbor Blogger.</li>
                      <li>Pilih area tata letak yang diinginkan (misal: <em>Sidebar</em> atau <em>Konten Utama</em>), lalu klik <strong className="text-slate-900">+ Tambahkan Gadget</strong>.</li>
                      <li>Dari daftar gadget yang muncul, pastikan pilih gadget bernama <strong className="text-orange-600 font-bold">HTML/JavaScript</strong>.</li>
                      <li>Isi kolom <strong className="text-slate-900">Judul</strong> (misal: <em>Hitung Cepat Pemilihan OSIS</em>).</li>
                      <li>Tempelkan kode embed HTML pada kolom <strong className="text-slate-900">Konten</strong>.</li>
                      <li>Klik tombol <strong className="text-slate-900">Simpan</strong> di kanan bawah. Widget hitung cepat akan selalu tampil di sidebar blog sekolah!</li>
                    </ol>
                  </div>
                )}

                {guideStep === 'page' && (
                  <div className="space-y-3.5 text-xs text-slate-700 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-black">3</span>
                      Cara Membuat Halaman Khusus E-Voting (Menu Navigasi Blog):
                    </h4>
                    <ol className="list-decimal list-inside space-y-2.5 ml-1 leading-relaxed">
                      <li>Buka menu <strong className="text-slate-900">Halaman (Pages)</strong> pada dasbor Blogger.</li>
                      <li>Klik <strong className="text-slate-900">+ Halaman Baru</strong>.</li>
                      <li>Ubah mode pengeditan ke <strong className="text-orange-600 font-bold">&lt;&gt; Tampilan HTML</strong>.</li>
                      <li>Tempelkan kode embed iframe dengan tinggi <em>800px</em> atau <em>1000px</em>.</li>
                      <li>Beri judul halaman: <em className="text-slate-900 font-medium">&ldquo;E-Pilketos Digital&rdquo;</em>, lalu klik <strong className="text-slate-900">Publikasikan</strong>.</li>
                      <li>Tautkan link halaman baru tersebut ke menu navigasi utama situs blog sekolah Anda.</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: DIRECT BLOGTHIS */}
            {activeTab === 'direct' && (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-white border border-orange-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FF5722] text-white flex items-center justify-center shadow-md shrink-0">
                      <BloggerIcon size={22} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Publikasi Otomatis ke Draft Postingan Blogger
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Fitur resmi <strong>Google BlogThis!</strong> memungkinkan Anda membuka editor Blogger secara otomatis dengan judul berita, tautan pemilihan, dan ringkasan yang telah disiapkan secara lengkap.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Judul Artikel Baru:</span>
                      <p className="text-xs font-bold text-slate-900">{postTitle}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Isi Ringkasan Artikel:</span>
                      <p className="text-xs text-slate-600 italic">&ldquo;{postSnippet}&rdquo;</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={handleShareToBloggerPost}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF5722] to-orange-500 hover:from-orange-600 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Buka & Tulis di Blogger Sekarang</span>
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                      (Akan membuka tab editor Blogger.com akun Anda)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SIMULASI TAMPILAN BLOG */}
            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-300/40 text-amber-900 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Simulasi pratinjau memperlihatkan bagaimana widget E-Pilketos akan muncul saat dipasang di halaman situs Blogger sekolah:
                  </span>
                </div>

                {/* Mocked Blogger Blog Container */}
                <div className="rounded-2xl border-2 border-slate-300 bg-white overflow-hidden shadow-lg">
                  {/* Mocked Blogger Browser Header */}
                  <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 bg-white px-3 py-1 rounded-md border border-slate-200">
                        https://smpn1teladan.blogspot.com/pilketos-live
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-1">
                      <BloggerIcon size={12} /> Blogger Preview
                    </span>
                  </div>

                  {/* Mocked Blog Body */}
                  <div className="p-5 space-y-4 bg-slate-50">
                    <div className="space-y-1">
                      <h2 className="text-base font-black text-slate-900">
                        {postTitle}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Diposting oleh Humas Sekolah · {new Date().toLocaleDateString('id-ID')}
                      </p>
                    </div>

                    {/* Embedded Frame Preview */}
                    <div className="rounded-xl overflow-hidden border border-slate-300 bg-white shadow-md">
                      <div className="p-2.5 bg-slate-900 text-white text-[11px] font-bold flex items-center justify-between">
                        <span>🗳️ E-Pilketos Digital · ${schoolName}</span>
                        <span className="text-emerald-400">● Live Terhubung</span>
                      </div>
                      <div className="p-6 text-center space-y-3 bg-gradient-to-b from-sky-50 to-white min-h-[160px] flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                          {selectedView === 'PUBLIC' ? <BarChart3 className="w-5 h-5" /> : <Vote className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            Pratinjau Widget {selectedView === 'PUBLIC' ? 'Quick Count' : 'Bilik Suara'} Aktif
                          </p>
                          <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                            Konten aplikasi dimuat secara interaktif dan responsif di Blogger dengan tinggi {selectedHeight}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kompatibel penuh dengan seluruh template tema Blogger & Blogspot.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {activeTab === 'theme_xml' ? (
                <button
                  onClick={handleCopyThemeXml}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md shadow-purple-700/20 active:scale-95 transition-all cursor-pointer"
                >
                  {copiedThemeXml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedThemeXml ? 'XML Tema Tersalin!' : 'Salin Template Tema XML'}</span>
                </button>
              ) : (
                <button
                  onClick={handleCopyCode}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF5722] hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Kode Tersalin!' : 'Salin Kode Embed'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
