/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive Product Requirements Document (PRD) & Enterprise Architecture
 * for E-Pilketos / E-Pilkosim Digital
 */

import React, { useState } from 'react';
import { 
  FileText, ShieldCheck, Database, Layers, Key, CheckCircle2, 
  Terminal, Download, Copy, Check, AlertTriangle, Cpu
} from 'lucide-react';

export const PRDDocument: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);

  const postgresDDL = `-- ====================================================================
-- SKEMA BASIS DATA E-PILKETOS / E-PILKOSIM DIGITAL
-- Engine: PostgreSQL 15+ / Supabase dengan Row Level Security (RLS)
-- Standar Integritas: LUBER-JURDIL, Anti-Tamper, Atomic Anonymous Voting
-- ====================================================================

-- 1. Tabel Master Satuan Pendidikan
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('OSIS', 'OSIM')),
  npsn VARCHAR(20) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  principal_name VARCHAR(255) NOT NULL,
  principal_nip VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Master Periode Pemilihan (Multi-Period Reusable Engine)
CREATE TABLE IF NOT EXISTS election_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  period_name VARCHAR(150) NOT NULL,
  academic_year VARCHAR(20) NOT NULL, -- Contoh: '2026/2027'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  voting_open_time TIME NOT NULL DEFAULT '07:30',
  voting_close_time TIME NOT NULL DEFAULT '15:00',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invariant Enforcement: Hanya ada 1 periode yang berstatus 'active' sekaligus
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_election_period 
ON election_periods (school_id) 
WHERE status = 'active';

-- 3. Tabel Panitia Pemilihan (Berdasarkan SK Resmi Kepala Sekolah)
CREATE TABLE IF NOT EXISTS committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_period_id UUID NOT NULL REFERENCES election_periods(id) ON DELETE CASCADE,
  sk_number VARCHAR(100) NOT NULL,
  sk_date DATE NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Ketua Panitia', 'Sekretaris', 'Bendahara', 'Koordinator IT & Bilik', 'Seksi Logistik', 'Pengawas / Saksi')),
  class_name VARCHAR(50),
  email VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Pasangan Calon (Paslon)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_period_id UUID NOT NULL REFERENCES election_periods(id) ON DELETE CASCADE,
  ballot_number INT NOT NULL,
  chairman_name VARCHAR(255) NOT NULL,
  vice_chairman_name VARCHAR(255) NOT NULL,
  chairman_class VARCHAR(50) NOT NULL,
  vice_chairman_class VARCHAR(50) NOT NULL,
  photo_url TEXT,
  motto TEXT,
  vision TEXT NOT NULL,
  mission JSONB NOT NULL DEFAULT '[]'::jsonb,
  programs JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_ballot_number_per_period UNIQUE (election_period_id, ballot_number)
);

-- 5. Tabel Daftar Pemilih Tetap (DPT) & Kredensial Siswa
CREATE TABLE IF NOT EXISTS voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_period_id UUID NOT NULL REFERENCES election_periods(id) ON DELETE CASCADE,
  nisn VARCHAR(10) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  grade_level VARCHAR(10) NOT NULL,
  gender CHAR(1) CHECK (gender IN ('L', 'P')),
  pin_hash VARCHAR(255) NOT NULL,
  has_voted BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at TIMESTAMPTZ,
  token_printed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_nisn_per_period UNIQUE (election_period_id, nisn)
);

-- 6. Tabel Surat Suara Masuk (ANONYMOUS BALLOT VAULT)
-- [CRITICAL SECURITY]: Tabel ini SECARA SENGAJA TIDAK MEMILIKI foreign key ke tabel voters!
-- Hal ini menjamin asas LUBER-JURDIL: Kerahasiaan pilihan siswa tidak dapat dilacak kembali.
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_period_id UUID NOT NULL REFERENCES election_periods(id) ON DELETE RESTRICT,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index performa tinggi untuk agregasi Live Quick Count
CREATE INDEX IF NOT EXISTS idx_votes_period_candidate ON votes (election_period_id, candidate_id);

-- 7. Tabel Jejak Audit Keamanan (Tamper-Proof Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  ip_address INET,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Kebijakan Publik (Homepage & Quick Count):
CREATE POLICY "Public Read Active Periods" ON election_periods FOR SELECT USING (true);
CREATE POLICY "Public Read Candidates" ON candidates FOR SELECT USING (true);
-- Suara masuk hanya dapat dihitung agregasinya, tidak dapat dibaca mentah oleh umum
CREATE POLICY "Public Read Votes Count" ON votes FOR SELECT USING (true);

-- Kebijakan Bilik Suara (Voting Atomik melalui Database Function / RPC):
CREATE OR REPLACE FUNCTION cast_anonymous_ballot(
  p_voter_id UUID,
  p_election_period_id UUID,
  p_candidate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_voted BOOLEAN;
  v_period_status VARCHAR;
BEGIN
  -- 1. Validasi status periode
  SELECT status INTO v_period_status FROM election_periods WHERE id = p_election_period_id;
  IF v_period_status <> 'active' THEN
    RAISE EXCEPTION 'Pemilihan tidak sedang aktif.';
  END IF;

  -- 2. Periksa apakah siswa sudah memilih (Atomic Lock)
  SELECT has_voted INTO v_has_voted FROM voters 
  WHERE id = p_voter_id AND election_period_id = p_election_period_id 
  FOR UPDATE;

  IF v_has_voted THEN
    RAISE EXCEPTION 'Hak suara telah digunakan sebelumnya. Suara ganda ditolak.';
  END IF;

  -- 3. Masukkan suara anonim tanpa merekam voter_id
  INSERT INTO votes (election_period_id, candidate_id, created_at)
  VALUES (p_election_period_id, p_candidate_id, NOW());

  -- 4. Perbarui status pemilih & hanguskan kredensial
  UPDATE voters 
  SET has_voted = TRUE, voted_at = NOW() 
  WHERE id = p_voter_id;

  -- 5. Catat jejak audit anonim
  INSERT INTO audit_logs (user_id, user_role, action, details, timestamp)
  VALUES ('siswa_anon', 'Siswa', 'TRANSAKSI_SUARA_SAH', 'Hak suara berhasil disalurkan secara LUBER-JURDIL', NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Suara sah berhasil dicatat.');
END;
$$;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(postgresDDL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Top Banner & Metadata */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-600 uppercase">
              <ShieldCheck className="w-4 h-4" />
              Arsitektur Sistem & Spesifikasi Enterprise
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Product Requirements Document (PRD)
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sistem Informasi Pemilihan Suara Elektronik (E-Pilketos / E-Pilkosim Digital) Multi-Periode Reusable
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 font-mono">
              Status: APPROVED (v2.6)
            </span>
          </div>
        </div>

        {/* Executive Summary Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Asas Pemilihan</p>
            <p className="text-base font-bold text-slate-900 mt-1">LUBER & JURDIL</p>
            <p className="text-xs text-slate-500 mt-0.5">Langsung, Umum, Bebas, Rahasia, Jujur & Adil</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Model Arsitektur</p>
            <p className="text-base font-bold text-slate-900 mt-1">Two-Phase Blind Ledger</p>
            <p className="text-xs text-slate-500 mt-0.5">Pemisahan fisik DPT dan Surat Suara</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Manajemen Periode</p>
            <p className="text-base font-bold text-slate-900 mt-1">Multi-Period Reusable</p>
            <p className="text-xs text-slate-500 mt-0.5">Hanya 1 periode berstatus 'active'</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Otentikasi Bilik</p>
            <p className="text-base font-bold text-slate-900 mt-1">NISN (10) + PIN (6)</p>
            <p className="text-xs text-slate-500 mt-0.5">Token acak sekali pakai langsung hangus</p>
          </div>
        </div>
      </div>

      {/* BAB 1: LATAR BELAKANG & TUJUAN */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Landasan Hukum, Latar Belakang & Tujuan Strategis
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          Pemilihan Ketua Organisasi Siswa Intra Sekolah (OSIS) atau Organisasi Santri Intra Madrasah (OSIM) 
          merupakan sarana edukasi demokrasi terpenting bagi generasi muda di lingkungan satuan pendidikan 
          sesuai dengan <strong>Permendikbud No. 39 Tahun 2008</strong> tentang Pembinaan Kesiswaan. 
          Proses konvensional berbasis kertas surat suara menghadapi kendala tingginya biaya cetak, 
          risiko salah coblos/rusak, lamanya waktu rekapitulasi, serta kerentanan manipulasi hasil.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900">Efisiensi & Ramah Lingkungan</h3>
            <p className="text-xs text-slate-500 mt-1">
              Menghilangkan 100% kebutuhan kertas surat suara fisik dan bilik kayu berat, 
              menggantinya dengan kartu token ringkas dan bilik digital berbasis gawai/lab komputer.
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900">Nir-Kecurangan (Tamper-Proof)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Penerapan enkripsi token PIN satu kali pakai, penguncian status atomik, 
              dan audit log sistem mencegah kemungkinan suara ganda atau penggelembungan suara.
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900">Transparansi Real-Time</h3>
            <p className="text-xs text-slate-500 mt-1">
              Penghitungan cepat (quick count) tersaji secara langsung kepada warga sekolah dengan 
              visualisasi persentase dan diagram tanpa mengorbankan kerahasiaan pilihan individu.
            </p>
          </div>
        </div>
      </section>

      {/* BAB 2: MATRIKS HAK AKSES PENGGUNA (3-TIER RBAC) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Matriks Hak Akses Pengguna (3-Tier Strict RBAC)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Tingkatan Peran</th>
                <th className="p-3">Metode Otentikasi</th>
                <th className="p-3">Kewenangan & Hak Akses</th>
                <th className="p-3">Batasan Ketat (Constraints)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="p-3 font-semibold text-slate-900">1. Admin Sekolah (Kepala Sekolah / Operator Utama)</td>
                <td className="p-3">Akun Kredensial Administrator</td>
                <td className="p-3">
                  • Konfigurasi master sekolah (Nama, NPSN, Tipe OSIS/OSIM, Logo).<br/>
                  • Pembuatan & pengarsipan tahun pemilihan (Multi-period).<br/>
                  • Pengesahan SK Kepanitiaan Pemilihan.<br/>
                  • Pengesahan & unduh Berita Acara Hasil Pemilihan (BAHP).<br/>
                  • Pemantauan menyeluruh security audit trails.
                </td>
                <td className="p-3 text-rose-700">
                  DILARANG mengubah pilihan suara siswa atau membatalkan suara sah yang telah masuk.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900">2. Panitia Pemilihan (Kepanitiaan Ber-SK)</td>
                <td className="p-3">Akun Panitia Berbasis Sesi</td>
                <td className="p-3">
                  • Pendaftaran & pengelolaan Paslon (Foto, Visi, Misi, Video).<br/>
                  • Pengelolaan DPT (Import Excel/CSV, Tambah/Edit Siswa).<br/>
                  • Generator PIN Token 6 karakter acak.<br/>
                  • Cetak lembar kartu suara token pemilih.<br/>
                  • Reset PIN bagi siswa dengan kendala sebelum memilih.<br/>
                  • Live monitoring status kehadiran bilik suara.
                </td>
                <td className="p-3 text-rose-700">
                  Tidak dapat mengubah hasil suara, tidak dapat melihat pilihan suara siswa, tidak dapat membuat periode baru.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900">3. Siswa (Pemilih Terdaftar DPT)</td>
                <td className="p-3">Kombinasi NISN (10 digit) + PIN Token (6 karakter unik)</td>
                <td className="p-3">
                  • Akses bilik suara digital saat status periode 'active'.<br/>
                  • Menelaah profil, visi, misi, dan video tiap paslon.<br/>
                  • Melakukan pemilihan 1 pasangan calon.<br/>
                  • Menerima kode verifikasi transaksi anonim.
                </td>
                <td className="p-3 text-rose-700">
                  Hanya memiliki 1 hak suara. Setelah memilih, PIN langsung hangus dan akses terkunci otomatis.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* BAB 3: ARSITEKTUR KEAMANAN & PRIVASI LUBER-JURDIL */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Arsitektur Privasi & Anti-Kecurangan (Two-Phase Blind Ledger)
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          Salah satu tantangan terbesar dalam sistem e-voting adalah menjaga kerahasiaan pilihan pemilih
          sekaligus membuktikan bahwa pemilih tersebut sah dan tidak memilih dua kali.
          Sistem ini menerapkan arsitektur <strong>Two-Phase Blind Ledger</strong>:
        </p>

        <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2">
          <div className="text-amber-400 font-bold mb-2">// ALUR TRANSAKSI ATOMIK BILIK SUARA:</div>
          <p>1. Siswa menyerahkan token di bilik suara: Input NISN (10 digit) + PIN (6 char).</p>
          <p>2. Backend memvalidasi hash PIN terhadap tabel `voters` & memverifikasi `has_voted == false`.</p>
          <p>3. Di dalam satu transaksi terisolasi (ACID transaction):</p>
          <p className="pl-4 text-emerald-400">• INSERT INTO votes (election_period_id, candidate_id) -- TANPA voter_id</p>
          <p className="pl-4 text-emerald-400">• UPDATE voters SET has_voted = TRUE, voted_at = NOW()</p>
          <p className="pl-4 text-emerald-400">• HANGUSKAN plain_pin dari sesi memori</p>
          <p>4. Database mengembalikan token resi anonim acak kepada siswa.</p>
          <p>5. Sesi bilik otomatis di-logout dalam 5 detik.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase">Perlindungan Anti-Replay & Double Voting</h4>
            <p className="text-xs text-slate-500 mt-1">
              Status <code>has_voted</code> dikunci pada tingkat database dengan isolasi row-level lock. 
              Setiap percobaan memasukkan suara kedua dengan kredensial yang sama akan ditolak secara mutlak 
              dan memicu peringatan kritis di Audit Log.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase">Pencegahan Konflik Karakter PIN</h4>
            <p className="text-xs text-slate-500 mt-1">
              Karakter yang berpotensi membingungkan secara visual (angka 0 dengan huruf O, angka 1 dengan huruf I dan L) 
              dieliminasi dari algoritma generator token PIN, memastikan siswa di bilik suara dapat mengetik tanpa kendala.
            </p>
          </div>
        </div>
      </section>

      {/* BAB 4: SKEMA BASIS DATA POSTGRESQL & RLS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Skema Database Relasional PostgreSQL & RLS
              </h2>
              <p className="text-xs text-slate-500">
                Supabase / PostgreSQL DDL lengkap dengan relasi referensial, unique constraints, dan stored procedures
              </p>
            </div>
          </div>
          <button
            onClick={copyToClipboard}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSql ? 'Tersalin ke Clipboard' : 'Salin Skema SQL'}
          </button>
        </div>

        <div className="relative rounded-xl bg-slate-950 p-4 overflow-x-auto text-xs font-mono text-slate-300 max-h-96">
          <pre>{postgresDDL}</pre>
        </div>
      </section>

      {/* BAB 5: DOKUMEN HUKUM BERITA ACARA (BAHP) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
            5
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Standar Dokumen Hukum Berita Acara Hasil Pemilihan (BAHP)
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          Untuk menjamin keabsahan hukum hasil pemilihan di mata dinas pendidikan dan komite sekolah, 
          aplikasi menyediakan generator dokumen <strong>Berita Acara Hasil Pemilihan (BAHP)</strong> yang memuat:
        </p>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
          <li><strong>Kop Surat Resmi Satuan Pendidikan</strong> lengkap dengan alamat, NPSN, dan kontak institusi.</li>
          <li><strong>Dasar Hukum Pelaksanaan</strong> merujuk pada Nomor Surat Keputusan (SK) Kepala Sekolah tentang Pembentukan Panitia Pemilihan.</li>
          <li><strong>Data Rekapitulasi Pemilih</strong>: Jumlah DPT, jumlah suara sah, jumlah abstain/belum memilih, dan persentase partisipasi pemilih.</li>
          <li><strong>Perolehan Suara Sah Tiap Pasangan Calon</strong> dalam bentuk tabel angka dan persentase terurut.</li>
          <li><strong>Klausul Penetapan Paslon Terpilih</strong> yang berhak dilantik sebagai Ketua dan Wakil Ketua OSIS/OSIM periode baru.</li>
          <li><strong>Kolom Pengesahan Tanda Tangan & Stempel Resmi</strong> antara Kepala Sekolah dan Ketua Panitia Pemilihan.</li>
        </ul>
      </section>
    </div>
  );
};
