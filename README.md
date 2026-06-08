# Dashboard Wakaf Nasional ANI

> Transformasi digital tata kelola wakaf Indonesia menuju Smart Nazhir Ecosystem 2030

[![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)](https://cloudflare.com)
[![Astro](https://img.shields.io/badge/Astro-BC52EE?style=flat&logo=astro&logoColor=white)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)

## Visi

Dashboard Wakaf Nasional ANI adalah sistem pelaporan terpusat berbasis SaaS yang dikembangkan oleh **Divisi Inovasi & Digitalisasi Asosiasi Nazhir Indonesia (ANI)** untuk menjawab tantangan tata kelola dan akuntabilitas perwakafan di era digital.

Sejalan dengan **Mandat Rakernas 2026-2030**, platform ini memposisikan diri sebagai pilar utama dalam membangun *public trust* melalui standar transparansi baru yang menjadi tolok ukur nasional dalam ekosistem filantropi Islam.

## Fitur Utama

- **Standardized Data Entry** — Multi-tenant data ingestion untuk aset wakaf (tanah, bangunan, uang) dan laporan keuangan
- **Impact Reporting** — Verifikasi dampak sosial program wakaf dengan metrik saintifik
- **Dashboard Analytics** — Visualisasi data real-time untuk pengambilan keputusan
- **Approval Workflow** — Alur persetujuan pelaporan dari pengurus hingga ANI Pusat
- **Export Laporan** — Generate PDF laporan standar ANI

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | Astro + React Islands + Tailwind CSS |
| **Backend** | Cloudflare Workers + tRPC |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Lucia Auth (edge-native) |
| **File Storage** | Cloudflare R2 |
| **Deploy** | Cloudflare Pages + Workers |

## Arsitektur

```
User → Cloudflare CDN → Pages (Astro Frontend)
                           ↓
                     Workers (tRPC API)
                           ↓
                     Supabase (PostgreSQL)
                           ↓
                     R2 (File Storage)
```

## Roadmap

| Tahun | Milestone |
|-------|-----------|
| **2026** | Fondasi — MVP Dashboard, Beta v1.0, Onboarding 20% pilot |
| **2027** | Edukasi — Soft launch platform fundraising, Sertifikasi digital |
| **2028** | Integrasi — 40% adopsi, API Kemenag/BWI |
| **2029** | Optimasi — AI-powered analytics, Audit ISO 27001 |
| **2030** | Kematangan — 85% adopsi, Rujukan data wakaf nasional |

## Tim Pengembang

**Divisi Inovasi & Digitalisasi ANI**

| Peran | Nama |
|-------|------|
| Ketua Divisi | Ridlo Abelian, S.T., M.Si., CTA, CWC |
| Sekretaris | Dr. Mayurida, M.Pd., CWC |
| Personel Kunci | Ahmad Faisal, Lc, M.E., CGE, CWC |
| | Iwan Hermawan, S.T., M.Si., CWC |
| | Wahju Prasetya, S.E., Ak., CWC |
| | Suranto, S.Kom, CWC |

## Dokumentasi

- [Product Requirements Document (PRD)](./Product%20Requirements%20Document%20(PRD)_%20Dashboard%20Wakaf%20Nasional%20ANI.md)
- [FSD — Functional Spec Document](./docs/FSD.md) *(coming soon)*
- [API Documentation](./docs/API.md) *(coming soon)*

## Development

```bash
# Clone repo
git clone https://github.com/ridloabelian/nazhir.id.git
cd nazhir.id/apps/web

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Generate Wrangler types
npm run generate-types
```

## Deploy

```bash
# Deploy ke Cloudflare Pages
npm run build
wrangler pages deploy dist
```

## Lisensi

Proprietary — Hak cipta © 2026 Asosiasi Nazhir Indonesia (ANI)

---

*"Smart Nazhir Ecosystem untuk kemaslahatan umat yang lebih luas"*
