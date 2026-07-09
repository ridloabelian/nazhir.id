import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context';

// Reuse the same tRPC instance shape as router.ts (context-typed).
const t = initTRPC.context<Context>().create();
const router = t.router;
const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Silakan login terlebih dahulu' });
  }
  return opts.next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});

type Sql = Context['sql'];
type User = NonNullable<Context['user']>;

// Guard: hanya Nazhir terverifikasi yang boleh menyentuh pembukuan miliknya.
async function assertVerifiedNazhir(sql: Sql, user: User) {
  if (user.role !== 'NAZHIR' || !user.nazhirId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Hanya akun Nazhir yang dapat melakukan aksi ini' });
  }
  const [n] = await sql`SELECT status_verifikasi FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
  if (!n || n.status_verifikasi !== 'VERIFIED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Akun lembaga Anda belum diverifikasi Admin ANI' });
  }
}

// Tolak transaksi bila tahun periode sudah dikunci (tutup buku).
async function assertNotLocked(sql: Sql, nazhirId: string, tahun: number) {
  const [locked] = await sql`SELECT id FROM lock_period WHERE nazhir_id = ${nazhirId} AND periode_tahun = ${tahun} LIMIT 1`;
  if (locked) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `Periode tahun ${tahun} sudah ditutup (lock). Buka kunci untuk mengubah.` });
  }
}

async function logAudit(sql: Sql, nazhirId: string, userId: string, aksi: string, entitas: string, entitasId: string | null, detail: string | null) {
  await sql`INSERT INTO audit_trail (id, nazhir_id, user_id, aksi, entitas, entitas_id, detail)
    VALUES (${crypto.randomUUID()}, ${nazhirId}, ${userId}, ${aksi}, ${entitas}, ${entitasId}, ${detail})`;
}

const barisSchema = z.object({
  akunId: z.string().min(1),
  debit: z.number().int().nonnegative().default(0),
  kredit: z.number().int().nonnegative().default(0),
});

export const akuntansiRouter = router({
  // --- BAGAN AKUN (COA) ---
  createAkun: protectedProcedure
    .input(z.object({
      kode: z.string().min(1),
      nama: z.string().min(2),
      tipe: z.enum(['ASET', 'LIABILITAS', 'ASET_NETO', 'PENDAPATAN', 'BEBAN']),
      saldoNormal: z.enum(['DEBIT', 'KREDIT']),
      parentId: z.string().nullable().optional(),
      isKas: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const id = crypto.randomUUID();
      try {
        await sql`INSERT INTO akun (id, nazhir_id, kode, nama, tipe, saldo_normal, parent_id, is_kas)
          VALUES (${id}, ${user.nazhirId}, ${input.kode}, ${input.nama}, ${input.tipe}, ${input.saldoNormal}, ${input.parentId ?? null}, ${input.isKas ? 1 : 0})`;
      } catch {
        throw new TRPCError({ code: 'CONFLICT', message: `Kode akun ${input.kode} sudah dipakai` });
      }
      await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'akun', id, input.kode);
      return { success: true, id };
    }),

  listAkun: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
    if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Butuh konteks lembaga Nazhir' });
    return await sql`SELECT id, kode, nama, tipe, saldo_normal, parent_id, is_kas FROM akun WHERE nazhir_id = ${scopeId} ORDER BY kode`;
  }),

  // Seed COA standar wakaf PSAK 412 sekali klik (2 tingkat).
  seedCoaStandar: protectedProcedure.mutation(async ({ ctx }) => {
    const { sql, user } = ctx;
    await assertVerifiedNazhir(sql, user);
    const existing = await sql`SELECT id FROM akun WHERE nazhir_id = ${user.nazhirId} LIMIT 1`;
    if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: 'Bagan akun sudah ada' });

    // [kode, nama, tipe, saldoNormal, parentKode|null, isKas]
    const coa: [string, string, string, string, string | null, boolean][] = [
      ['1000', 'ASET', 'ASET', 'DEBIT', null, false],
      ['1100', 'Kas dan Setara Kas', 'ASET', 'DEBIT', '1000', true],
      ['1200', 'Aset Tetap Wakaf', 'ASET', 'DEBIT', '1000', false],
      ['1300', 'Investasi Wakaf', 'ASET', 'DEBIT', '1000', false],
      ['2000', 'LIABILITAS', 'LIABILITAS', 'KREDIT', null, false],
      ['2100', 'Utang Jangka Pendek', 'LIABILITAS', 'KREDIT', '2000', false],
      ['3000', 'ASET NETO', 'ASET_NETO', 'KREDIT', null, false],
      ['3100', 'Aset Neto Wakaf Permanen', 'ASET_NETO', 'KREDIT', '3000', false],
      ['3200', 'Aset Neto Wakaf Temporer', 'ASET_NETO', 'KREDIT', '3000', false],
      ['4000', 'PENERIMAAN', 'PENDAPATAN', 'KREDIT', null, false],
      ['4100', 'Penerimaan Wakaf Uang', 'PENDAPATAN', 'KREDIT', '4000', false],
      ['4200', 'Penerimaan Wakaf Melalui Uang', 'PENDAPATAN', 'KREDIT', '4000', false],
      ['4300', 'Hasil Pengelolaan Wakaf', 'PENDAPATAN', 'KREDIT', '4000', false],
      ['5000', 'BEBAN & PENYALURAN', 'BEBAN', 'DEBIT', null, false],
      ['5100', 'Penyaluran Manfaat kepada Mauquf Alaih', 'BEBAN', 'DEBIT', '5000', false],
      ['5200', 'Beban Operasional Nazhir', 'BEBAN', 'DEBIT', '5000', false],
      ['5300', 'Beban Penyusutan', 'BEBAN', 'DEBIT', '5000', false],
    ];
    const kodeToId = new Map<string, string>();
    for (const [kode, nama, tipe, saldo, parentKode, isKas] of coa) {
      const id = crypto.randomUUID();
      kodeToId.set(kode, id);
      const parentId = parentKode ? kodeToId.get(parentKode) ?? null : null;
      await sql`INSERT INTO akun (id, nazhir_id, kode, nama, tipe, saldo_normal, parent_id, is_kas)
        VALUES (${id}, ${user.nazhirId}, ${kode}, ${nama}, ${tipe}, ${saldo}, ${parentId}, ${isKas ? 1 : 0})`;
    }
    await logAudit(sql, user.nazhirId!, user.id, 'SEED', 'akun', null, `${coa.length} akun`);
    return { success: true, count: coa.length };
  }),

  // --- TRANSAKSI / JURNAL OTOMATIS (double-entry, satu input) ---
  createTransaksi: protectedProcedure
    .input(z.object({
      tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
      kategori: z.enum(['PENERIMAAN', 'PENGELOLAAN', 'PENYALURAN', 'UMUM']),
      deskripsi: z.string().min(3),
      baris: z.array(barisSchema).min(2, 'Jurnal butuh minimal 2 baris (debit & kredit)'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const tahun = Number(input.tanggal.slice(0, 4));
      await assertNotLocked(sql, user.nazhirId!, tahun);

      // Validasi double-entry: total debit === total kredit, > 0.
      const totalDebit = input.baris.reduce((s, b) => s + b.debit, 0);
      const totalKredit = input.baris.reduce((s, b) => s + b.kredit, 0);
      if (totalDebit !== totalKredit) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Jurnal tidak balance: debit ${totalDebit} ≠ kredit ${totalKredit}` });
      }
      if (totalDebit <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Total jurnal harus > 0' });
      for (const b of input.baris) {
        const ok = (b.debit > 0 && b.kredit === 0) || (b.kredit > 0 && b.debit === 0);
        if (!ok) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tiap baris hanya boleh debit ATAU kredit' });
      }

      // Pastikan semua akun milik nazhir ini (cek per-baris; tagged template
      // tak mendukung klausa IN dinamis dengan aman).
      const akunIds = input.baris.map((b) => b.akunId);
      const ownedSet = new Set<string>();
      for (const aId of akunIds) {
        const [row] = await sql`SELECT id FROM akun WHERE id = ${aId} AND nazhir_id = ${user.nazhirId} LIMIT 1`;
        if (row) ownedSet.add(aId);
      }
      if (ownedSet.size !== new Set(akunIds).size) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ada akun yang tidak valid untuk lembaga ini' });
      }

      const txId = crypto.randomUUID();
      try {
        await sql`INSERT INTO transaksi (id, nazhir_id, tanggal, kategori, deskripsi, total, status, dibuat_oleh)
          VALUES (${txId}, ${user.nazhirId}, ${input.tanggal}, ${input.kategori}, ${input.deskripsi}, ${totalDebit}, 'DIAJUKAN', ${user.id})`;
        for (const b of input.baris) {
          await sql`INSERT INTO jurnal_baris (id, transaksi_id, akun_id, debit, kredit)
            VALUES (${crypto.randomUUID()}, ${txId}, ${b.akunId}, ${b.debit}, ${b.kredit})`;
        }
      } catch (e) {
        await sql`DELETE FROM jurnal_baris WHERE transaksi_id = ${txId}`.catch(() => []);
        await sql`DELETE FROM transaksi WHERE id = ${txId}`.catch(() => []);
        throw e;
      }
      await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'transaksi', txId, input.deskripsi);
      return { success: true, id: txId };
    }),

  listTransaksi: protectedProcedure
    .input(z.object({ status: z.enum(['DIAJUKAN', 'DISETUJUI', 'DITOLAK']).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      if (user.role === 'NAZHIR') {
        if (input?.status) {
          return await sql`SELECT id, tanggal, kategori, deskripsi, total, status, catatan_review, created_at
            FROM transaksi WHERE nazhir_id = ${user.nazhirId} AND status = ${input.status} ORDER BY tanggal DESC, created_at DESC`;
        }
        return await sql`SELECT id, tanggal, kategori, deskripsi, total, status, catatan_review, created_at
          FROM transaksi WHERE nazhir_id = ${user.nazhirId} ORDER BY tanggal DESC, created_at DESC`;
      }
      return await sql`SELECT t.id, t.tanggal, t.kategori, t.deskripsi, t.total, t.status, t.created_at, n.nama_lembaga
        FROM transaksi t JOIN nazhir n ON t.nazhir_id = n.id ORDER BY t.created_at DESC`;
    }),

  getTransaksiDetail: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      const [tx] = await sql`SELECT id, nazhir_id, tanggal, kategori, deskripsi, total, status, catatan_review FROM transaksi WHERE id = ${input.id} LIMIT 1`;
      if (!tx) throw new TRPCError({ code: 'NOT_FOUND' });
      if (user.role === 'NAZHIR' && tx.nazhir_id !== user.nazhirId) throw new TRPCError({ code: 'FORBIDDEN' });
      const baris = await sql`SELECT jb.debit, jb.kredit, a.kode, a.nama FROM jurnal_baris jb JOIN akun a ON jb.akun_id = a.id WHERE jb.transaksi_id = ${input.id}`;
      return { transaksi: tx, baris };
    }),

  // Maker-checker: Ketua/Admin menyetujui atau menolak.
  reviewTransaksi: protectedProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(['DISETUJUI', 'DITOLAK']), catatan: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Hanya Ketua/Admin (checker) yang dapat menyetujui transaksi' });
      }
      const [tx] = await sql`SELECT id, nazhir_id, status FROM transaksi WHERE id = ${input.id} LIMIT 1`;
      if (!tx) throw new TRPCError({ code: 'NOT_FOUND' });
      if (tx.status !== 'DIAJUKAN') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transaksi sudah direview' });
      await sql`UPDATE transaksi SET status = ${input.status}, disetujui_oleh = ${user.id}, catatan_review = ${input.catatan ?? null} WHERE id = ${input.id}`;
      await logAudit(sql, tx.nazhir_id, user.id, input.status, 'transaksi', input.id, input.catatan ?? null);
      return { success: true };
    }),

  // --- BUKU BESAR & NERACA SALDO (hanya transaksi DISETUJUI) ---
  bukuBesar: protectedProcedure
    .input(z.object({ akunId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
      if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN' });
      return await sql`SELECT t.tanggal, t.deskripsi, jb.debit, jb.kredit
        FROM jurnal_baris jb JOIN transaksi t ON jb.transaksi_id = t.id
        WHERE jb.akun_id = ${input.akunId} AND t.nazhir_id = ${scopeId} AND t.status = 'DISETUJUI'
        ORDER BY t.tanggal`;
    }),

  neracaSaldo: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
    if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN' });
    // Saldo per akun = SUM(debit/kredit) hanya dari transaksi DISETUJUI.
    return await sql`SELECT a.kode, a.nama, a.tipe, a.saldo_normal,
        COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.debit ELSE 0 END),0) AS total_debit,
        COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.kredit ELSE 0 END),0) AS total_kredit
      FROM akun a
      LEFT JOIN jurnal_baris jb ON jb.akun_id = a.id
      LEFT JOIN transaksi t ON t.id = jb.transaksi_id
      WHERE a.nazhir_id = ${scopeId}
      GROUP BY a.id ORDER BY a.kode`;
  }),

  // --- LAPORAN PSAK 412: Laporan Posisi Keuangan ringkas + Aktivitas ---
  laporanPsak412: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
    if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN' });
    const rows = await sql`SELECT a.tipe, a.saldo_normal,
        COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.debit ELSE 0 END),0) AS d,
        COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.kredit ELSE 0 END),0) AS k
      FROM akun a
      LEFT JOIN jurnal_baris jb ON jb.akun_id = a.id
      LEFT JOIN transaksi t ON t.id = jb.transaksi_id
      WHERE a.nazhir_id = ${scopeId} GROUP BY a.id`;
    const agg: Record<string, number> = { ASET: 0, LIABILITAS: 0, ASET_NETO: 0, PENDAPATAN: 0, BEBAN: 0 };
    for (const r of rows as any[]) {
      const saldo = r.saldo_normal === 'DEBIT' ? r.d - r.k : r.k - r.d;
      agg[r.tipe] = (agg[r.tipe] ?? 0) + saldo;
    }
    const totalAset = agg.ASET;
    const totalLiabilitas = agg.LIABILITAS;
    const surplusDefisit = agg.PENDAPATAN - agg.BEBAN;
    const asetNeto = agg.ASET_NETO + surplusDefisit;
    return {
      posisiKeuangan: {
        totalAset,
        totalLiabilitas,
        totalAsetNeto: asetNeto,
        balance: totalAset - (totalLiabilitas + asetNeto), // idealnya 0
      },
      aktivitas: {
        totalPenerimaan: agg.PENDAPATAN,
        totalPenyaluranBeban: agg.BEBAN,
        surplusDefisit,
      },
    };
  }),

  // --- ASET TETAP + PENYUSUTAN GARIS LURUS ---
  createAsetTetap: protectedProcedure
    .input(z.object({
      nama: z.string().min(2),
      kategori: z.enum(['TANAH', 'BANGUNAN', 'KENDARAAN', 'RUMAH_MAKAN', 'GREEN_HOUSE', 'LAINNYA']),
      nilaiPerolehan: z.number().int().nonnegative(),
      tanggalPerolehan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      umurManfaatBulan: z.number().int().nonnegative().default(0),
      urlDokumenLegal: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const id = crypto.randomUUID();
      await sql`INSERT INTO aset_tetap (id, nazhir_id, nama, kategori, nilai_perolehan, tanggal_perolehan, umur_manfaat_bulan, url_dokumen_legal)
        VALUES (${id}, ${user.nazhirId}, ${input.nama}, ${input.kategori}, ${input.nilaiPerolehan}, ${input.tanggalPerolehan}, ${input.umurManfaatBulan}, ${input.urlDokumenLegal ?? null})`;
      await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'aset_tetap', id, input.nama);
      return { success: true, id };
    }),

  listAsetTetap: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
    if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN' });
    return await sql`SELECT id, nama, kategori, nilai_perolehan, tanggal_perolehan, umur_manfaat_bulan, akumulasi_penyusutan, url_dokumen_legal, created_at
      FROM aset_tetap WHERE nazhir_id = ${scopeId} ORDER BY created_at DESC`;
  }),

  // Jalankan penyusutan garis lurus untuk 1 periode (idempotent via UNIQUE).
  jalankanPenyusutan: protectedProcedure
    .input(z.object({ periodeBulan: z.number().int().min(1).max(12), periodeTahun: z.number().int().min(2020) }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const aset = await sql`SELECT id, nilai_perolehan, umur_manfaat_bulan, akumulasi_penyusutan FROM aset_tetap
        WHERE nazhir_id = ${user.nazhirId} AND umur_manfaat_bulan > 0`;
      let diproses = 0;
      for (const a of aset as any[]) {
        const sudah = await sql`SELECT id FROM penyusutan_log WHERE aset_tetap_id = ${a.id} AND periode_bulan = ${input.periodeBulan} AND periode_tahun = ${input.periodeTahun} LIMIT 1`;
        if (sudah.length > 0) continue;
        const sisa = a.nilai_perolehan - a.akumulasi_penyusutan;
        if (sisa <= 0) continue;
        const bulanan = Math.floor(a.nilai_perolehan / a.umur_manfaat_bulan);
        const nilai = Math.min(bulanan, sisa);
        if (nilai <= 0) continue;
        const logId = crypto.randomUUID();
        try {
          await sql`INSERT INTO penyusutan_log (id, aset_tetap_id, periode_bulan, periode_tahun, nilai_penyusutan)
            VALUES (${logId}, ${a.id}, ${input.periodeBulan}, ${input.periodeTahun}, ${nilai})`;
          await sql`UPDATE aset_tetap SET akumulasi_penyusutan = akumulasi_penyusutan + ${nilai} WHERE id = ${a.id}`;
          diproses++;
        } catch (e) {
          await sql`DELETE FROM penyusutan_log WHERE id = ${logId}`.catch(() => []);
          throw e;
        }
      }
      await logAudit(sql, user.nazhirId!, user.id, 'PENYUSUTAN', 'aset_tetap', null, `${input.periodeBulan}/${input.periodeTahun}: ${diproses} aset`);
      return { success: true, diproses };
    }),

  // --- TUTUP BUKU (lock period) ---
  tutupBuku: protectedProcedure
    .input(z.object({ periodeTahun: z.number().int().min(2020) }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const [pending] = await sql`SELECT id FROM transaksi WHERE nazhir_id = ${user.nazhirId} AND status = 'DIAJUKAN' AND substr(tanggal,1,4) = ${String(input.periodeTahun)} LIMIT 1`;
      if (pending) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Masih ada transaksi DIAJUKAN di tahun ini. Review dulu sebelum tutup buku.' });
      try {
        await sql`INSERT INTO lock_period (id, nazhir_id, periode_tahun, dikunci_oleh) VALUES (${crypto.randomUUID()}, ${user.nazhirId}, ${input.periodeTahun}, ${user.id})`;
      } catch {
        throw new TRPCError({ code: 'CONFLICT', message: 'Periode ini sudah ditutup' });
      }
      await logAudit(sql, user.nazhirId!, user.id, 'LOCK', 'lock_period', null, String(input.periodeTahun));
      return { success: true };
    }),

  // --- AUDIT TRAIL ---
  auditTrail: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    const scopeId = user.role === 'NAZHIR' ? user.nazhirId : null;
    if (!scopeId) throw new TRPCError({ code: 'FORBIDDEN' });
    return await sql`SELECT aksi, entitas, entitas_id, detail, created_at FROM audit_trail WHERE nazhir_id = ${scopeId} ORDER BY created_at DESC LIMIT 200`;
  }),
});
