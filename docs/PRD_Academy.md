# PRD: Modul Academy (LMS) Terintegrasi nazhir.id

## 1. Konteks
Asosiasi Nazhir Indonesia (ANI) membutuhkan platform e-learning (INA - Indonesia Nazhir Academy) yang *fully embedded* ke dalam ekosistem `nazhir.id`. Tidak ada sistem terpisah. Single Sign-On (SSO) menggunakan Auth yang sudah ada di sistem.

## 2. Fitur Inti (MVP)
1. **Katalog Kelas (`/academy`)**: List course/pelatihan.
2. **Detail Kelas & Enrollment (`/academy/[id]`)**: Deskripsi, silabus, tombol daftar (terhubung ke profil nazhir).
3. **Player Materi (`/academy/learn/[id]`)**: UI e-learning (Kiri: Video YouTube Unlisted, Kanan: List Modul/Progress).
4. **Library (`/academy/library`)**: Repository file dokumen/pdf (terhubung CF R2).
5. **Dashboard Progress (`/dashboard/academy`)**: Status belajar dan sertifikat.

## 3. Database Schema Tambahan (Supabase)
Tabel yang perlu disiapkan:
- `courses` (id, title, description, thumbnail, instructor, is_published)
- `lessons` (id, course_id, title, content, video_url, order_index)
- `enrollments` (id, user_id, course_id, progress, status, completed_at)
- `materials` (id, course_id, file_url_r2, title, type)

## 4. Stack
- **UI**: Astro (Statis) untuk katalog, React Islands untuk interaktivitas (Video player, checklist progress).
- **Backend**: CF Workers + Supabase.
- **Storage**: Cloudflare R2 (Bebas dari limit egress).

## 5. Instruksi Eksekusi untuk Agent/Vibecoding
1. Baca skema database Supabase saat ini.
2. Generate script SQL untuk tabel `courses`, `lessons`, `enrollments`.
3. Scaffold halaman `/academy` di Astro menggunakan komponen UI yang sudah ada (Tailwind).