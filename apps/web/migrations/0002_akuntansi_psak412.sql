-- Modul Akuntansi Wakaf PSAK 412 untuk nazhir.id
-- Double-entry: setiap transaksi = 1 header + >=2 baris jurnal (SUM debit == SUM kredit).
-- Semua nilai uang disimpan sebagai INTEGER (rupiah penuh, tanpa desimal sen) untuk hindari float drift.
-- Multi-tenant: semua tabel di-scope per nazhir_id.

-- Bagan Akun (Chart of Accounts) 2 tingkat.
-- parent_id NULL = akun induk; parent_id terisi = sub-akun.
-- tipe: ASET, LIABILITAS, ASET_NETO, PENDAPATAN, BEBAN (klasifikasi PSAK 412 wakaf).
CREATE TABLE IF NOT EXISTS akun (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  kode TEXT NOT NULL,
  nama TEXT NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('ASET','LIABILITAS','ASET_NETO','PENDAPATAN','BEBAN')),
  saldo_normal TEXT NOT NULL CHECK (saldo_normal IN ('DEBIT','KREDIT')),
  parent_id TEXT REFERENCES akun(id) ON DELETE RESTRICT,
  is_kas INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (nazhir_id, kode)
);

-- Header transaksi/jurnal. Maker-checker: DIAJUKAN (Bendahara) -> DISETUJUI (Ketua/Admin) atau DITOLAK.
-- kategori mengikuti alur wakaf: PENERIMAAN (wakaf masuk), PENGELOLAAN (mutasi/investasi), PENYALURAN (mauquf alaih), UMUM.
CREATE TABLE IF NOT EXISTS transaksi (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('PENERIMAAN','PENGELOLAAN','PENYALURAN','UMUM')),
  deskripsi TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL DEFAULT 'DIAJUKAN' CHECK (status IN ('DIAJUKAN','DISETUJUI','DITOLAK')),
  dibuat_oleh TEXT NOT NULL REFERENCES users(id),
  disetujui_oleh TEXT REFERENCES users(id),
  catatan_review TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Baris jurnal (double-entry). Tepat salah satu dari debit/kredit > 0.
CREATE TABLE IF NOT EXISTS jurnal_baris (
  id TEXT PRIMARY KEY,
  transaksi_id TEXT NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  akun_id TEXT NOT NULL REFERENCES akun(id) ON DELETE RESTRICT,
  debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  kredit INTEGER NOT NULL DEFAULT 0 CHECK (kredit >= 0),
  CHECK ((debit > 0 AND kredit = 0) OR (kredit > 0 AND debit = 0))
);

-- Aset tetap wakaf + penyusutan garis lurus otomatis.
CREATE TABLE IF NOT EXISTS aset_tetap (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('TANAH','BANGUNAN','KENDARAAN','RUMAH_MAKAN','GREEN_HOUSE','LAINNYA')),
  nilai_perolehan INTEGER NOT NULL CHECK (nilai_perolehan >= 0),
  tanggal_perolehan TEXT NOT NULL,
  umur_manfaat_bulan INTEGER NOT NULL DEFAULT 0 CHECK (umur_manfaat_bulan >= 0),
  akumulasi_penyusutan INTEGER NOT NULL DEFAULT 0 CHECK (akumulasi_penyusutan >= 0),
  url_dokumen_legal TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log penyusutan bulanan (idempotent per aset per periode).
CREATE TABLE IF NOT EXISTS penyusutan_log (
  id TEXT PRIMARY KEY,
  aset_tetap_id TEXT NOT NULL REFERENCES aset_tetap(id) ON DELETE CASCADE,
  periode_bulan INTEGER NOT NULL CHECK (periode_bulan BETWEEN 1 AND 12),
  periode_tahun INTEGER NOT NULL CHECK (periode_tahun >= 2020),
  nilai_penyusutan INTEGER NOT NULL CHECK (nilai_penyusutan >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (aset_tetap_id, periode_bulan, periode_tahun)
);

-- Audit trail: siapa mengubah apa & kapan (Good Waqf Governance).
CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  aksi TEXT NOT NULL,
  entitas TEXT NOT NULL,
  entitas_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tutup buku (lock period): periode terkunci tolak transaksi baru/ubah.
CREATE TABLE IF NOT EXISTS lock_period (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  periode_tahun INTEGER NOT NULL CHECK (periode_tahun >= 2020),
  dikunci_oleh TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (nazhir_id, periode_tahun)
);

CREATE INDEX IF NOT EXISTS idx_akun_nazhir ON akun(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_akun_parent ON akun(parent_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_nazhir ON transaksi(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_status ON transaksi(status);
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi(tanggal);
CREATE INDEX IF NOT EXISTS idx_jurnal_transaksi ON jurnal_baris(transaksi_id);
CREATE INDEX IF NOT EXISTS idx_jurnal_akun ON jurnal_baris(akun_id);
CREATE INDEX IF NOT EXISTS idx_aset_tetap_nazhir ON aset_tetap(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_penyusutan_aset ON penyusutan_log(aset_tetap_id);
CREATE INDEX IF NOT EXISTS idx_audit_nazhir ON audit_trail(nazhir_id);
