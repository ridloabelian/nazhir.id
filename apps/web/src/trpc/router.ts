import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context';
import { hashPassword, verifyPassword } from '../auth/password';
import { akuntansiRouter } from './akuntansi';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Silakan login terlebih dahulu' });
  }
  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

async function assertVerifiedNazhir(sql: Context['sql'], user: NonNullable<Context['user']>) {
  if (user.role !== 'NAZHIR' || !user.nazhirId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Hanya akun Nazhir yang dapat melakukan aksi ini' });
  }
  const [nazhir] = await sql`SELECT status_verifikasi FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
  if (!nazhir || nazhir.status_verifikasi !== 'VERIFIED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Akun lembaga Anda belum diverifikasi Admin ANI' });
  }
}

const authRouter = router({
  registerNazhir: publicProcedure
    .input(z.object({
      email: z.string().email('Format email tidak valid'),
      password: z.string().min(8, 'Password minimal terdiri dari 8 karakter'),
      namaLembaga: z.string().min(3, 'Nama lembaga minimal 3 karakter'),
      noRegBwi: z.string().min(3, 'Nomor registrasi BWI minimal 3 karakter'),
      alamat: z.string().min(5, 'Alamat minimal 5 karakter'),
      telepon: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql } = ctx;
      
      // 1. Cek apakah email terdaftar
      const existingUser = await sql`SELECT id FROM users WHERE email = ${input.email} LIMIT 1`;
      if (existingUser.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email sudah terdaftar' });
      }

      // 2. Cek nomor BWI terdaftar
      const existingBwi = await sql`SELECT id FROM nazhir WHERE no_reg_bwi = ${input.noRegBwi} LIMIT 1`;
      if (existingBwi.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Nomor registrasi BWI sudah terdaftar' });
      }

      try {
        const result = await sql.begin(async (tx) => {
          const nazhirId = crypto.randomUUID();
          const [nazhir] = await tx`
            INSERT INTO nazhir (id, nama_lembaga, no_reg_bwi, alamat, telepon)
            VALUES (${nazhirId}, ${input.namaLembaga}, ${input.noRegBwi}, ${input.alamat}, ${input.telepon ?? null})
            RETURNING id
          `;

          const userId = crypto.randomUUID();
          const hashedPassword = hashPassword(input.password);

          await tx`
            INSERT INTO users (id, email, hashed_password, role, nazhir_id)
            VALUES (${userId}, ${input.email}, ${hashedPassword}, 'NAZHIR', ${nazhir.id})
          `;

          return { userId };
        });

        const session = await ctx.lucia.createSession(result.userId, {});
        const sessionCookie = ctx.lucia.createSessionCookie(session.id);
        
        ctx.cookies.set(sessionCookie.name, sessionCookie.value, {
          ...sessionCookie.attributes,
          sameSite: sessionCookie.attributes.sameSite === 'none' ? 'none' : 
                    sessionCookie.attributes.sameSite === 'strict' ? 'strict' : 'lax'
        });
        
        return { success: true };
      } catch (error) {
        console.error('Registration Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal melakukan registrasi, silakan coba lagi.',
        });
      }
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email('Format email tidak valid'),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql } = ctx;
      const [user] = await sql`
        SELECT id, email, hashed_password, role, nazhir_id 
        FROM users 
        WHERE email = ${input.email} 
        LIMIT 1
      `;
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email atau password salah' });
      }

      const isValidPassword = verifyPassword(input.password, user.hashed_password);
      if (!isValidPassword) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email atau password salah' });
      }

      const session = await ctx.lucia.createSession(user.id, {});
      const sessionCookie = ctx.lucia.createSessionCookie(session.id);

      ctx.cookies.set(sessionCookie.name, sessionCookie.value, {
        ...sessionCookie.attributes,
        sameSite: sessionCookie.attributes.sameSite === 'none' ? 'none' : 
                  sessionCookie.attributes.sameSite === 'strict' ? 'strict' : 'lax'
      });

      return { success: true };
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.lucia.invalidateSession(ctx.session.id);
      const sessionCookie = ctx.lucia.createBlankSessionCookie();
      ctx.cookies.set(sessionCookie.name, sessionCookie.value, {
        ...sessionCookie.attributes,
        sameSite: sessionCookie.attributes.sameSite === 'none' ? 'none' : 
                  sessionCookie.attributes.sameSite === 'strict' ? 'strict' : 'lax'
      });
      return { success: true };
    }),

  getMe: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        return { user: null };
      }
      
      const { sql } = ctx;
      let nazhir = null;
      
      if (ctx.user.nazhirId) {
        const [nazhirProfile] = await sql`
          SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at
          FROM nazhir
          WHERE id = ${ctx.user.nazhirId}
          LIMIT 1
        `;
        nazhir = nazhirProfile || null;
      }

      return {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          role: ctx.user.role,
        },
        nazhir,
      };
    }),
});

const asetRouter = router({
  createAset: protectedProcedure
    .input(z.object({
      tipeAset: z.enum(['TANAH', 'BANGUNAN', 'UANG', 'SURAT_BERHARGA']),
      namaAset: z.string().min(3, 'Nama aset minimal 3 karakter'),
      nilaiEstimasi: z.number().nonnegative('Nilai estimasi tidak boleh negatif'),
      luasTanah: z.number().nullable().optional(),
      luasBangunan: z.number().nullable().optional(),
      alamatAset: z.string().nullable().optional(),
      urlSertifikat: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      
      const [aset] = await sql`
        INSERT INTO aset_wakaf (
          nazhir_id, tipe_aset, nama_aset, nilai_estimasi, 
          luas_tanah, luas_bangunan, alamat_aset, url_sertifikat
        ) VALUES (
          ${user.nazhirId}, ${input.tipeAset}, ${input.namaAset}, ${input.nilaiEstimasi},
          ${input.luasTanah ?? null}, ${input.luasBangunan ?? null}, ${input.alamatAset ?? null}, ${input.urlSertifikat ?? null}
        ) RETURNING id
      `;
      return { success: true, id: aset.id };
    }),

  updateAset: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      tipeAset: z.enum(['TANAH', 'BANGUNAN', 'UANG', 'SURAT_BERHARGA']),
      namaAset: z.string().min(3),
      nilaiEstimasi: z.number().nonnegative(),
      luasTanah: z.number().nullable().optional(),
      luasBangunan: z.number().nullable().optional(),
      alamatAset: z.string().nullable().optional(),
      urlSertifikat: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const [aset] = await sql`
        UPDATE aset_wakaf
        SET tipe_aset = ${input.tipeAset}, nama_aset = ${input.namaAset}, nilai_estimasi = ${input.nilaiEstimasi}, luas_tanah = ${input.luasTanah ?? null}, luas_bangunan = ${input.luasBangunan ?? null}, alamat_aset = ${input.alamatAset ?? null}, url_sertifikat = COALESCE(${input.urlSertifikat ?? null}, url_sertifikat), status_approval = 'DRAFT', catatan_revisi = null
        WHERE id = ${input.id} AND nazhir_id = ${user.nazhirId} AND status_approval IN ('DRAFT', 'REJECTED')
        RETURNING id
      `;
      if (!aset) throw new TRPCError({ code: 'FORBIDDEN', message: 'Aset tidak bisa diedit' });
      return { success: true, id: aset.id };
    }),

  submitAset: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const [aset] = await sql`
        UPDATE aset_wakaf SET status_approval = 'SUBMITTED', catatan_revisi = null
        WHERE id = ${input.id} AND nazhir_id = ${user.nazhirId} AND status_approval IN ('DRAFT', 'REJECTED')
        RETURNING id
      `;
      if (!aset) throw new TRPCError({ code: 'FORBIDDEN', message: 'Aset tidak bisa diajukan' });
      return { success: true };
    }),

  getAsetList: protectedProcedure
    .query(async ({ ctx }) => {
      const { sql, user } = ctx;
      if (user.role === 'NAZHIR') {
        return await sql`
          SELECT id, tipe_aset, nama_aset, nilai_estimasi, status_approval, catatan_revisi, url_sertifikat, created_at
          FROM aset_wakaf
          WHERE nazhir_id = ${user.nazhirId}
          ORDER BY created_at DESC
        `;
      } else {
        return await sql`
          SELECT a.id, a.tipe_aset, a.nama_aset, a.nilai_estimasi, a.status_approval, a.catatan_revisi, a.url_sertifikat, a.created_at, n.nama_lembaga
          FROM aset_wakaf a
          JOIN nazhir n ON a.nazhir_id = n.id
          ORDER BY a.created_at DESC
        `;
      }
    }),

  approveAset: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['APPROVED', 'REJECTED']),
      catatanRevisi: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      if (user.role !== 'ADMIN_ANI') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Hanya Admin ANI yang dapat memverifikasi aset' });
      }

      await sql`
        UPDATE aset_wakaf
        SET status_approval = ${input.status}, catatan_revisi = ${input.catatanRevisi ?? null}
        WHERE id = ${input.id}
      `;
      return { success: true };
    }),
});

const keuanganRouter = router({
  submitLaporan: protectedProcedure
    .input(z.object({
      periodeBulan: z.number().min(1).max(12),
      periodeTahun: z.number().min(2020),
      totalPenerimaan: z.number().nonnegative(),
      totalPenyaluran: z.number().nonnegative(),
      urlDokumenPdf: z.string().min(1, 'Dokumen PDF wajib diunggah'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);

      // Cek apakah laporan periode tersebut sudah ada
      const existing = await sql`
        SELECT id FROM laporan_keuangan 
        WHERE nazhir_id = ${user.nazhirId} AND periode_bulan = ${input.periodeBulan} AND periode_tahun = ${input.periodeTahun}
        LIMIT 1
      `;
      if (existing.length > 0) {
        const [laporan] = await sql`
          UPDATE laporan_keuangan
          SET total_penerimaan = ${input.totalPenerimaan}, total_penyaluran = ${input.totalPenyaluran}, url_dokumen_pdf = ${input.urlDokumenPdf}, status_approval = 'SUBMITTED', catatan_revisi = null
          WHERE nazhir_id = ${user.nazhirId} AND periode_bulan = ${input.periodeBulan} AND periode_tahun = ${input.periodeTahun} AND status_approval = 'REJECTED'
          RETURNING id
        `;
        if (laporan) return { success: true, id: laporan.id };
        throw new TRPCError({ code: 'CONFLICT', message: 'Laporan keuangan untuk periode ini sudah pernah dikirim.' });
      }

      const [laporan] = await sql`
        INSERT INTO laporan_keuangan (
          nazhir_id, periode_bulan, periode_tahun, total_penerimaan, total_penyaluran, url_dokumen_pdf
        ) VALUES (
          ${user.nazhirId}, ${input.periodeBulan}, ${input.periodeTahun}, ${input.totalPenerimaan}, ${input.totalPenyaluran}, ${input.urlDokumenPdf}
        ) RETURNING id
      `;
      return { success: true, id: laporan.id };
    }),

  getLaporanList: protectedProcedure
    .query(async ({ ctx }) => {
      const { sql, user } = ctx;
      if (user.role === 'NAZHIR') {
        return await sql`
          SELECT id, periode_bulan, periode_tahun, total_penerimaan, total_penyaluran, url_dokumen_pdf, status_approval, catatan_revisi, created_at
          FROM laporan_keuangan
          WHERE nazhir_id = ${user.nazhirId}
          ORDER BY periode_tahun DESC, periode_bulan DESC
        `;
      } else {
        return await sql`
          SELECT l.id, l.periode_bulan, l.periode_tahun, l.total_penerimaan, l.total_penyaluran, l.url_dokumen_pdf, l.status_approval, l.catatan_revisi, l.created_at, n.nama_lembaga
          FROM laporan_keuangan l
          JOIN nazhir n ON l.nazhir_id = n.id
          ORDER BY l.created_at DESC
        `;
      }
    }),

  approveLaporan: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['APPROVED', 'REJECTED']),
      catatanRevisi: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      if (user.role !== 'ADMIN_ANI') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Hanya Admin ANI yang dapat memverifikasi laporan' });
      }

      await sql`
        UPDATE laporan_keuangan
        SET status_approval = ${input.status}, catatan_revisi = ${input.catatanRevisi ?? null}
        WHERE id = ${input.id}
      `;
      return { success: true };
    }),
});

const dampakRouter = router({
  submitDampak: protectedProcedure
    .input(z.object({
      namaProgram: z.string().min(3, 'Nama program minimal 3 karakter'),
      jumlahPenerima: z.number().int().nonnegative(),
      sektorDampak: z.enum(['PENDIDIKAN', 'KESEHATAN', 'EKONOMI', 'SOSIAL']),
      deskripsiDampak: z.string().min(10, 'Deskripsi minimal 10 karakter'),
      metrikTambahan: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sql, user } = ctx;
      await assertVerifiedNazhir(sql, user);
      const [dampak] = await sql`INSERT INTO laporan_dampak_sosial (nazhir_id, nama_program, jumlah_penerima, sektor_dampak, deskripsi_dampak, metrik_tambahan) VALUES (${user.nazhirId}, ${input.namaProgram}, ${input.jumlahPenerima}, ${input.sektorDampak}, ${input.deskripsiDampak}, ${JSON.stringify(input.metrikTambahan ?? {})}) RETURNING id`;
      return { success: true, id: dampak.id };
    }),
  getDampakList: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    return user.role === 'NAZHIR'
      ? await sql`SELECT id, nama_program, jumlah_penerima, sektor_dampak, deskripsi_dampak, metrik_tambahan, created_at FROM laporan_dampak_sosial WHERE nazhir_id = ${user.nazhirId} ORDER BY created_at DESC`
      : await sql`SELECT d.id, d.nama_program, d.jumlah_penerima, d.sektor_dampak, d.deskripsi_dampak, d.metrik_tambahan, d.created_at, n.nama_lembaga FROM laporan_dampak_sosial d JOIN nazhir n ON d.nazhir_id = n.id ORDER BY d.created_at DESC`;
  }),
});

const nazhirRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    if (!user.nazhirId) return { profile: null };
    const [profile] = await sql`SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
    return { profile: profile || null };
  }),
  updateProfile: protectedProcedure.input(z.object({ namaLembaga: z.string().min(3), alamat: z.string().min(5), telepon: z.string().optional().nullable() })).mutation(async ({ input, ctx }) => {
    const { sql, user } = ctx;
    if (!user.nazhirId) throw new TRPCError({ code: 'FORBIDDEN' });
    await sql`UPDATE nazhir SET nama_lembaga = ${input.namaLembaga}, alamat = ${input.alamat}, telepon = ${input.telepon ?? null} WHERE id = ${user.nazhirId}`;
    return { success: true };
  }),
  listNazhir: protectedProcedure.query(async ({ ctx }) => {
    const { sql, user } = ctx;
    if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') throw new TRPCError({ code: 'FORBIDDEN' });
    return await sql`SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at FROM nazhir ORDER BY created_at DESC`;
  }),
  verifyNazhir: protectedProcedure.input(z.object({ id: z.string().uuid(), status: z.enum(['VERIFIED','REJECTED']) })).mutation(async ({ input, ctx }) => {
    const { sql, user } = ctx;
    if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') throw new TRPCError({ code: 'FORBIDDEN' });
    await sql`UPDATE nazhir SET status_verifikasi = ${input.status} WHERE id = ${input.id}`;
    return { success: true };
  }),
});

export const appRouter = router({
  auth: authRouter,
  nazhir: nazhirRouter,
  aset: asetRouter,
  keuangan: keuanganRouter,
  dampak: dampakRouter,
  akuntansi: akuntansiRouter,
});

export type AppRouter = typeof appRouter;

