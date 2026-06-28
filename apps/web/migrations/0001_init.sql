-- D1 (SQLite) schema for nazhir.id
-- UUIDs are generated in application code (crypto.randomUUID); created_at as ISO text.

CREATE TABLE IF NOT EXISTS nazhir (
  id TEXT PRIMARY KEY,
  nama_lembaga TEXT NOT NULL,
  no_reg_bwi TEXT UNIQUE NOT NULL,
  alamat TEXT NOT NULL,
  telepon TEXT,
  status_verifikasi TEXT NOT NULL DEFAULT 'PENDING' CHECK (status_verifikasi IN ('PENDING','VERIFIED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'NAZHIR' CHECK (role IN ('ADMIN_ANI','VERIFIKATOR','NAZHIR')),
  nazhir_id TEXT REFERENCES nazhir(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lucia v3 sqlite adapter expects: id TEXT PK, user_id TEXT, expires_at INTEGER (unix seconds)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS aset_wakaf (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  tipe_aset TEXT NOT NULL CHECK (tipe_aset IN ('TANAH','BANGUNAN','UANG','SURAT_BERHARGA')),
  nama_aset TEXT NOT NULL,
  nilai_estimasi REAL NOT NULL DEFAULT 0 CHECK (nilai_estimasi >= 0),
  luas_tanah REAL,
  luas_bangunan REAL,
  alamat_aset TEXT,
  url_sertifikat TEXT,
  status_approval TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status_approval IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  catatan_revisi TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS laporan_keuangan (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  periode_bulan INTEGER NOT NULL CHECK (periode_bulan BETWEEN 1 AND 12),
  periode_tahun INTEGER NOT NULL CHECK (periode_tahun >= 2020),
  total_penerimaan REAL NOT NULL DEFAULT 0 CHECK (total_penerimaan >= 0),
  total_penyaluran REAL NOT NULL DEFAULT 0 CHECK (total_penyaluran >= 0),
  url_dokumen_pdf TEXT NOT NULL,
  status_approval TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status_approval IN ('SUBMITTED','APPROVED','REJECTED')),
  catatan_revisi TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (nazhir_id, periode_bulan, periode_tahun)
);

CREATE TABLE IF NOT EXISTS laporan_dampak_sosial (
  id TEXT PRIMARY KEY,
  nazhir_id TEXT NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
  nama_program TEXT NOT NULL,
  jumlah_penerima INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_penerima >= 0),
  sektor_dampak TEXT NOT NULL CHECK (sektor_dampak IN ('PENDIDIKAN','KESEHATAN','EKONOMI','SOSIAL')),
  deskripsi_dampak TEXT NOT NULL,
  metrik_tambahan TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_nazhir_id ON users(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_aset_wakaf_nazhir_id ON aset_wakaf(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_aset_wakaf_status_approval ON aset_wakaf(status_approval);
CREATE INDEX IF NOT EXISTS idx_laporan_keuangan_nazhir_id ON laporan_keuangan(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_laporan_keuangan_status_approval ON laporan_keuangan(status_approval);
CREATE INDEX IF NOT EXISTS idx_laporan_dampak_nazhir_id ON laporan_dampak_sosial(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_laporan_dampak_sektor ON laporan_dampak_sosial(sektor_dampak);
