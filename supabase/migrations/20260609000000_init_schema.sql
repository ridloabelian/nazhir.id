-- Enable pgcrypto extension for UUID generation if needed (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: nazhir
CREATE TABLE IF NOT EXISTS nazhir (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_lembaga VARCHAR(255) NOT NULL,
    no_reg_bwi VARCHAR(100) UNIQUE NOT NULL,
    alamat TEXT NOT NULL,
    telepon VARCHAR(20),
    status_verifikasi VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status_verifikasi IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY, -- Lucia Auth user ID format (usually string/nanoid)
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'NAZHIR' CHECK (role IN ('ADMIN_ANI', 'VERIFIKATOR', 'NAZHIR')),
    nazhir_id UUID REFERENCES nazhir(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table: sessions (Lucia Auth v3 / v4 Session Table)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 4. Table: aset_wakaf
CREATE TABLE IF NOT EXISTS aset_wakaf (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazhir_id UUID NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
    tipe_aset VARCHAR(50) NOT NULL CHECK (tipe_aset IN ('TANAH', 'BANGUNAN', 'UANG', 'SURAT_BERHARGA')),
    nama_aset VARCHAR(255) NOT NULL,
    nilai_estimasi NUMERIC(15, 2) NOT NULL CHECK (nilai_estimasi >= 0),
    luas_tanah NUMERIC(10, 2), -- Opsional, dalam m²
    luas_bangunan NUMERIC(10, 2), -- Opsional, dalam m²
    alamat_aset TEXT,
    url_sertifikat TEXT, -- R2 Link
    status_approval VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status_approval IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    catatan_revisi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Table: laporan_keuangan
CREATE TABLE IF NOT EXISTS laporan_keuangan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazhir_id UUID NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
    periode_bulan INT NOT NULL CHECK (periode_bulan BETWEEN 1 AND 12),
    periode_tahun INT NOT NULL CHECK (periode_tahun >= 2020),
    total_penerimaan NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_penerimaan >= 0),
    total_penyaluran NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_penyaluran >= 0),
    url_dokumen_pdf TEXT NOT NULL, -- R2 Link
    status_approval VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED' CHECK (status_approval IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
    catatan_revisi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Mencegah pelaporan ganda untuk bulan & tahun yang sama bagi satu lembaga
    UNIQUE (nazhir_id, periode_bulan, periode_tahun)
);

-- 6. Table: laporan_dampak_sosial
CREATE TABLE IF NOT EXISTS laporan_dampak_sosial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazhir_id UUID NOT NULL REFERENCES nazhir(id) ON DELETE CASCADE,
    nama_program VARCHAR(255) NOT NULL,
    jumlah_penerima INT NOT NULL DEFAULT 0 CHECK (jumlah_penerima >= 0),
    sektor_dampak VARCHAR(100) NOT NULL CHECK (sektor_dampak IN ('PENDIDIKAN', 'KESEHATAN', 'EKONOMI', 'SOSIAL')),
    deskripsi_dampak TEXT NOT NULL,
    metrik_tambahan JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_nazhir_id ON users(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_aset_wakaf_nazhir_id ON aset_wakaf(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_aset_wakaf_status_approval ON aset_wakaf(status_approval);
CREATE INDEX IF NOT EXISTS idx_laporan_keuangan_nazhir_id ON laporan_keuangan(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_laporan_keuangan_status_approval ON laporan_keuangan(status_approval);
CREATE INDEX IF NOT EXISTS idx_laporan_dampak_nazhir_id ON laporan_dampak_sosial(nazhir_id);
CREATE INDEX IF NOT EXISTS idx_laporan_dampak_sektor ON laporan_dampak_sosial(sektor_dampak);
