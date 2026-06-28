# Product Requirements Document (PRD) V2: Dashboard Wakaf Nasional ANI

## 1. Visi Produk & Definisi Masalah
**Problem:** Data aset, keuangan, dan dampak wakaf dari para Nazhir anggota Asosiasi Nazhir Indonesia (ANI) tersebar, tidak terstandar, dan sulit diverifikasi. Hal ini menghambat transparansi publik dan menyulitkan pelaporan agregat ke regulator (BWI/Kemenag).
**Solution:** `nazhir.id` — Platform SaaS terpusat (Single Source of Truth) untuk input data standar, verifikasi oleh admin/verifikator, agregasi statistik nasional, dan publikasi transparansi wakaf.

## 2. Core Loop & Value Proposition
1. **Nazhir** menginput data terstandar (Aset, Keuangan, Dampak).
2. **Admin/Verifikator** mereview dan menyetujui (Approve/Reject) dengan workflow jelas.
3. **Sistem** mengagregasi data menjadi statistik nasional *real-time*.
4. **Publik & Regulator** melihat profil kredibilitas Nazhir dan dampak nasional, meningkatkan *Public Trust*.

## 3. Minimum Viable Product (MVP) Scope - 2026
Fokus pada fungsionalitas inti yang menyelesaikan *pain points* utama tanpa over-engineering.

### A. Autentikasi & Otorisasi
- **Roles:** `NAZHIR`, `ADMIN_ANI`, `VERIFIKATOR`.
- **Registrasi Nazhir:** Input profil lembaga (Nama, No Reg BWI, Wilayah, Kontak) -> Status `PENDING`.
- **Verifikasi Akun:** Admin/Verifikator meng-approve pendaftaran -> Status `VERIFIED`. (Hanya Nazhir terverifikasi yang bisa menambah aset/laporan).

### B. Modul Aset Wakaf
- **Entitas:** Tipe Aset (Tanah, Bangunan, Uang, dll), Nama, Nilai Estimasi, Luas, Lokasi, Dokumen (AIW/Sertifikat).
- **Workflow:** `DRAFT` (disimpan lokal) -> `SUBMITTED` (diajukan) -> `APPROVED` (masuk agregat nasional) / `REJECTED` (dikembalikan dengan catatan revisi).
- **Aksi:** Nazhir dapat mengedit aset berstatus DRAFT atau REJECTED.

### C. Modul Keuangan (Bulanan/Tahunan)
- **Entitas:** Periode (Bulan/Tahun), Total Penerimaan, Total Penyaluran, Saldo, Dokumen PDF.
- **Workflow:** `SUBMITTED` -> `APPROVED` / `REJECTED`.
- **Aksi:** Validasi *unique constraint* per periode. Jika REJECTED, Nazhir dapat menimpa (submit ulang) periode tersebut.

### D. Modul Dampak Sosial (Program)
- **Entitas:** Nama Program, Sektor (Kesehatan, Pendidikan, Ekonomi, dll), Jumlah Penerima Manfaat, Deskripsi, Metrik Tambahan.
- **Workflow:** Input langsung (asumsi verified).
- **Aksi:** Agregasi jumlah jiwa/penerima manfaat secara nasional.

### E. Dashboard Admin & Verifikator
- **Antrean (Queue):** List Nazhir, Aset, dan Laporan yang menunggu verifikasi (`PENDING`/`SUBMITTED`).
- **Aksi Cepat:** Tombol Approve/Reject dengan input alasan penolakan.
- **Filter:** Berdasarkan status dan wilayah (untuk Verifikator daerah).

### F. Homepage & Portal Publik
- **Landing Page:** Value proposition ANI.
- **Statistik Agregat (Real-time):** Total aset, valuasi aset, kas masuk/keluar nasional, total penerima manfaat dari seluruh aset/laporan berstatus `APPROVED`.
- **Pencarian Nazhir:** Fitur cek status dan profil publik Nazhir terverifikasi.

## 4. Metrik Keberhasilan MVP
- **Adopsi:** 20 Nazhir pilot project on-boarded dan aktif submit data selama 3 bulan berturut-turut.
- **Data Quality:** 100% data agregat nasional berasal dari entry yang telah divalidasi dan di-approve.

## 5. Out of Scope (MVP) / Roadmap Lanjutan
Hal-hal berikut ditunda untuk fase setelah MVP stabil:
- *AI Predictive Analytics* (Tren wakaf & donatur).
- Integrasi API dua arah dengan Kemenag/BWI (Menunggu kesiapan regulator).
- Platform *Fundraising* Bersama (Fokus pada pelaporan data terlebih dahulu).
- Sertifikasi ISO 27001 formal (Penerapan best-practices keamanan tetap dilakukan sejak awal).

---
*Dokumen ini merupakan turunan praktis (Product-Builder version) dari Visi Makro PRD ANI, didesain untuk eksekusi iterative Loop Engineering.*
