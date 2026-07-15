import type { APIRoute } from 'astro';
import { Hono } from 'hono';
import { env } from 'cloudflare:workers';
import { getDB } from '../../db';
import { getLucia } from '../../auth';
import { hashPassword, verifyPassword } from '../../auth/password';

const app = new Hono<{
  Variables: {
    sql: ReturnType<typeof getDB>;
    lucia: ReturnType<typeof getLucia>;
    user: any;
    session: any;
  }
}>({ strict: false });

// Middleware Setup DB & Auth
app.use('*', async (c, next) => {
  const sql = getDB(env as any);
  const isProd = import.meta.env.PROD;
  const lucia = getLucia(sql, isProd);
  
  c.set('sql', sql);
  c.set('lucia', lucia);

  // Authenticate session from Cookie
  const cookieHeader = c.req.header('cookie') || '';
  const sessionId = cookieHeader
    .split(';')
    .map(v => v.split('='))
    .find(v => v[0].trim() === lucia.sessionCookieName)?.[1];

  if (sessionId) {
    try {
      const { user, session } = await lucia.validateSession(sessionId);
      if (session) {
        c.set('user', user);
        c.set('session', session);
      }
    } catch (_) {}
  }
  await next();
});

// Guard helper
const getAuth = (c: any) => {
  const user = c.get('user');
  const session = c.get('session');
  if (!user || !session) {
    c.status(401);
    throw new Error('Silakan login terlebih dahulu');
  }
  return { user, session };
};

// Guard: verified nazhir
const assertVerifiedNazhir = async (sql: any, user: any) => {
  if (user.role !== 'NAZHIR' || !user.nazhirId) {
    throw new Error('Hanya akun Nazhir yang dapat melakukan aksi ini');
  }
  const [nazhir] = await sql`SELECT status_verifikasi FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
  if (!nazhir || nazhir.status_verifikasi !== 'VERIFIED') {
    throw new Error('Akun lembaga Anda belum diverifikasi Admin ANI');
  }
};

// Auth routes
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  const sql = c.get('sql');
  const lucia = c.get('lucia');

  const existingUser = await sql`SELECT id FROM users WHERE email = ${body.email} LIMIT 1`;
  if (existingUser.length > 0) {
    return c.json({ error: 'Email sudah terdaftar' }, 409);
  }
  const existingBwi = await sql`SELECT id FROM nazhir WHERE no_reg_bwi = ${body.noRegBwi} LIMIT 1`;
  if (existingBwi.length > 0) {
    return c.json({ error: 'Nomor registrasi BWI sudah terdaftar' }, 409);
  }

  const nazhirId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await sql`
    INSERT INTO nazhir (id, nama_lembaga, no_reg_bwi, alamat, telepon)
    VALUES (${nazhirId}, ${body.namaLembaga}, ${body.noRegBwi}, ${body.alamat}, ${body.telepon ?? null})
  `;
  const hashedPassword = hashPassword(body.password);
  await sql`
    INSERT INTO users (id, email, hashed_password, role, nazhir_id)
    VALUES (${userId}, ${body.email}, ${hashedPassword}, 'NAZHIR', ${nazhirId})
  `;

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  c.header('Set-Cookie', sessionCookie.serialize(), { append: true });
  return c.json({ success: true });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const sql = c.get('sql');
  const lucia = c.get('lucia');

  const [user] = await sql`SELECT id, email, hashed_password, role, nazhir_id FROM users WHERE email = ${body.email} LIMIT 1`;
  if (!user || !verifyPassword(body.password, user.hashed_password)) {
    return c.json({ error: 'Email atau password salah' }, 401);
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  c.header('Set-Cookie', sessionCookie.serialize(), { append: true });
  return c.json({ success: true });
});

app.post('/api/auth/logout', async (c) => {
  const { session } = getAuth(c);
  const lucia = c.get('lucia');
  await lucia.invalidateSession(session.id);
  const blankCookie = lucia.createBlankSessionCookie();
  c.header('Set-Cookie', blankCookie.serialize(), { append: true });
  return c.json({ success: true });
});

app.get('/api/auth/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null });
  const sql = c.get('sql');
  let nazhir = null;
  if (user.nazhirId) {
    const [n] = await sql`SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
    nazhir = n || null;
  }
  return c.json({
    user: { id: user.id, email: user.email, role: user.role },
    nazhir
  });
});

// Aset routes
app.post('/api/aset/create', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await sql`INSERT INTO aset_wakaf (id, nazhir_id, tipe_aset, nama_aset, nilai_estimasi, luas_tanah, luas_bangunan, alamat_aset, url_sertifikat)
    VALUES (${id}, ${user.nazhirId}, ${body.tipeAset}, ${body.namaAset}, ${body.nilaiEstimasi}, ${body.luasTanah ?? null}, ${body.luasBangunan ?? null}, ${body.alamatAset ?? null}, ${body.urlSertifikat ?? null})`;
  return c.json({ success: true, id });
});

app.post('/api/aset/update', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const [aset] = await sql`
    UPDATE aset_wakaf
    SET tipe_aset = ${body.tipeAset}, nama_aset = ${body.namaAset}, nilai_estimasi = ${body.nilaiEstimasi}, luas_tanah = ${body.luasTanah ?? null}, luas_bangunan = ${body.luasBangunan ?? null}, alamat_aset = ${body.alamatAset ?? null}, url_sertifikat = COALESCE(${body.urlSertifikat ?? null}, url_sertifikat), status_approval = 'DRAFT', catatan_revisi = null
    WHERE id = ${body.id} AND nazhir_id = ${user.nazhirId} AND status_approval IN ('DRAFT', 'REJECTED')
    RETURNING id
  `;
  if (!aset) return c.json({ error: 'Aset tidak bisa diedit' }, 403);
  return c.json({ success: true, id: aset.id });
});

app.post('/api/aset/submit', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const [aset] = await sql`
    UPDATE aset_wakaf SET status_approval = 'SUBMITTED', catatan_revisi = null
    WHERE id = ${body.id} AND nazhir_id = ${user.nazhirId} AND status_approval IN ('DRAFT', 'REJECTED')
    RETURNING id
  `;
  if (!aset) return c.json({ error: 'Aset tidak bisa diajukan' }, 403);
  return c.json({ success: true });
});

app.get('/api/aset/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (user.role === 'NAZHIR') {
    const list = await sql`SELECT id, tipe_aset, nama_aset, nilai_estimasi, status_approval, catatan_revisi, url_sertifikat, created_at FROM aset_wakaf WHERE nazhir_id = ${user.nazhirId} ORDER BY created_at DESC`;
    return c.json(list);
  }
  const list = await sql`SELECT a.id, a.tipe_aset, a.nama_aset, a.nilai_estimasi, a.status_approval, a.catatan_revisi, a.url_sertifikat, a.created_at, n.nama_lembaga FROM aset_wakaf a JOIN nazhir n ON a.nazhir_id = n.id ORDER BY a.created_at DESC`;
  return c.json(list);
});

app.post('/api/aset/approve', async (c) => {
  const { user } = getAuth(c);
  if (user.role !== 'ADMIN_ANI') return c.json({ error: 'Forbidden' }, 403);
  const sql = c.get('sql');
  const body = await c.req.json();
  await sql`UPDATE aset_wakaf SET status_approval = ${body.status}, catatan_revisi = ${body.catatanRevisi ?? null} WHERE id = ${body.id}`;
  return c.json({ success: true });
});

// Keuangan routes
app.post('/api/keuangan/submit', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();

  const existing = await sql`SELECT id FROM laporan_keuangan WHERE nazhir_id = ${user.nazhirId} AND periode_bulan = ${body.periodeBulan} AND periode_tahun = ${body.periodeTahun} LIMIT 1`;
  if (existing.length > 0) {
    const [laporan] = await sql`
      UPDATE laporan_keuangan
      SET total_penerimaan = ${body.totalPenerimaan}, total_penyaluran = ${body.totalPenyaluran}, url_dokumen_pdf = ${body.urlDokumenPdf}, status_approval = 'SUBMITTED', catatan_revisi = null
      WHERE nazhir_id = ${user.nazhirId} AND periode_bulan = ${body.periodeBulan} AND periode_tahun = ${body.periodeTahun} AND status_approval = 'REJECTED'
      RETURNING id
    `;
    if (laporan) return c.json({ success: true, id: laporan.id });
    return c.json({ error: 'Laporan keuangan untuk periode ini sudah pernah dikirim.' }, 409);
  }

  const [laporan] = await sql`
    INSERT INTO laporan_keuangan (id, nazhir_id, periode_bulan, periode_tahun, total_penerimaan, total_penyaluran, url_dokumen_pdf)
    VALUES (${crypto.randomUUID()}, ${user.nazhirId}, ${body.periodeBulan}, ${body.periodeTahun}, ${body.totalPenerimaan}, ${body.totalPenyaluran}, ${body.urlDokumenPdf})
    RETURNING id
  `;
  return c.json({ success: true, id: laporan.id });
});

app.get('/api/keuangan/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (user.role === 'NAZHIR') {
    const list = await sql`SELECT id, periode_bulan, periode_tahun, total_penerimaan, total_penyaluran, url_dokumen_pdf, status_approval, catatan_revisi, created_at FROM laporan_keuangan WHERE nazhir_id = ${user.nazhirId} ORDER BY periode_tahun DESC, periode_bulan DESC`;
    return c.json(list);
  }
  const list = await sql`SELECT l.id, l.periode_bulan, l.periode_tahun, l.total_penerimaan, l.total_penyaluran, l.url_dokumen_pdf, l.status_approval, l.catatan_revisi, l.created_at, n.nama_lembaga FROM laporan_keuangan l JOIN nazhir n ON l.nazhir_id = n.id ORDER BY l.created_at DESC`;
  return c.json(list);
});

app.post('/api/keuangan/approve', async (c) => {
  const { user } = getAuth(c);
  if (user.role !== 'ADMIN_ANI') return c.json({ error: 'Forbidden' }, 403);
  const sql = c.get('sql');
  const body = await c.req.json();
  await sql`UPDATE laporan_keuangan SET status_approval = ${body.status}, catatan_revisi = ${body.catatanRevisi ?? null} WHERE id = ${body.id}`;
  return c.json({ success: true });
});

// Dampak routes
app.post('/api/dampak/submit', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await sql`INSERT INTO laporan_dampak_social (id, nazhir_id, nama_program, jumlah_penerima, sektor_dampak, deskripsi_dampak, metrik_tambahan)
    VALUES (${id}, ${user.nazhirId}, ${body.namaProgram}, ${body.jumlahPenerima}, ${body.sektorDampak}, ${body.deskripsiDampak}, ${JSON.stringify(body.metrikTambahan ?? {})})`;
  return c.json({ success: true, id });
});

app.get('/api/dampak/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (user.role === 'NAZHIR') {
    const list = await sql`SELECT id, nama_program, jumlah_penerima, sektor_dampak, deskripsi_dampak, metrik_tambahan, created_at FROM laporan_dampak_social WHERE nazhir_id = ${user.nazhirId} ORDER BY created_at DESC`;
    return c.json(list);
  }
  const list = await sql`SELECT d.id, d.nama_program, d.jumlah_penerima, d.sektor_dampak, d.deskripsi_dampak, d.metrik_tambahan, d.created_at, n.nama_lembaga FROM laporan_dampak_social d JOIN nazhir n ON d.nazhir_id = n.id ORDER BY d.created_at DESC`;
  return c.json(list);
});

// Profile routes
app.get('/api/nazhir/profile', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ profile: null });
  const [profile] = await sql`SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at FROM nazhir WHERE id = ${user.nazhirId} LIMIT 1`;
  return c.json({ profile: profile || null });
});

app.post('/api/nazhir/profile', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const body = await c.req.json();
  await sql`UPDATE nazhir SET nama_lembaga = ${body.namaLembaga}, alamat = ${body.alamat}, telepon = ${body.telepon ?? null} WHERE id = ${user.nazhirId}`;
  return c.json({ success: true });
});

app.get('/api/nazhir/list', async (c) => {
  const { user } = getAuth(c);
  if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') return c.json({ error: 'Forbidden' }, 403);
  const sql = c.get('sql');
  const list = await sql`SELECT id, nama_lembaga, no_reg_bwi, alamat, telepon, status_verifikasi, created_at FROM nazhir ORDER BY created_at DESC`;
  return c.json(list);
});

app.post('/api/nazhir/verify', async (c) => {
  const { user } = getAuth(c);
  if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') return c.json({ error: 'Forbidden' }, 403);
  const sql = c.get('sql');
  const body = await c.req.json();
  await sql`UPDATE nazhir SET status_verifikasi = ${body.status} WHERE id = ${body.id}`;
  return c.json({ success: true });
});

// --- AKUNTANSI / PSAK 412 ---
const assertNotLocked = async (sql: any, nazhirId: string, tahun: number) => {
  const [locked] = await sql`SELECT id FROM lock_period WHERE nazhir_id = ${nazhirId} AND periode_tahun = ${tahun} LIMIT 1`;
  if (locked) throw new Error(`Periode tahun ${tahun} sudah ditutup (lock).`);
};

const logAudit = async (sql: any, nazhirId: string, userId: string, aksi: string, entitas: string, entitasId: string | null, detail: string | null) => {
  await sql`INSERT INTO audit_trail (id, nazhir_id, user_id, aksi, entitas, entitas_id, detail)
    VALUES (${crypto.randomUUID()}, ${nazhirId}, ${userId}, ${aksi}, ${entitas}, ${entitasId}, ${detail})`;
};

app.post('/api/akuntansi/akun/create', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  try {
    await sql`INSERT INTO akun (id, nazhir_id, kode, nama, tipe, saldo_normal, parent_id, is_kas)
      VALUES (${id}, ${user.nazhirId}, ${body.kode}, ${body.nama}, ${body.tipe}, ${body.saldoNormal}, ${body.parentId ?? null}, ${body.isKas ? 1 : 0})`;
  } catch {
    return c.json({ error: `Kode akun ${body.kode} sudah dipakai` }, 409);
  }
  await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'akun', id, body.kode);
  return c.json({ success: true, id });
});

app.get('/api/akuntansi/akun/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const list = await sql`SELECT id, kode, nama, tipe, saldo_normal, parent_id, is_kas FROM akun WHERE nazhir_id = ${user.nazhirId} ORDER BY kode`;
  return c.json(list);
});

app.post('/api/akuntansi/akun/seed-coa', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const existing = await sql`SELECT id FROM akun WHERE nazhir_id = ${user.nazhirId} LIMIT 1`;
  if (existing.length > 0) return c.json({ error: 'Bagan akun sudah ada' }, 409);

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
  return c.json({ success: true, count: coa.length });
});

app.post('/api/akuntansi/transaksi/create', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const tahun = Number(body.tanggal.slice(0, 4));
  await assertNotLocked(sql, user.nazhirId!, tahun);

  const totalDebit = body.baris.reduce((s: number, b: any) => s + b.debit, 0);
  const totalKredit = body.baris.reduce((s: number, b: any) => s + b.kredit, 0);
  if (totalDebit !== totalKredit || totalDebit <= 0) {
    return c.json({ error: 'Jurnal tidak balance atau kurang dari nol' }, 400);
  }

  const txId = crypto.randomUUID();
  await sql`INSERT INTO transaksi (id, nazhir_id, tanggal, kategori, deskripsi, total, status, dibuat_oleh)
    VALUES (${txId}, ${user.nazhirId}, ${body.tanggal}, ${body.kategori}, ${body.deskripsi}, ${totalDebit}, 'DIAJUKAN', ${user.id})`;
  for (const b of body.baris) {
    await sql`INSERT INTO jurnal_baris (id, transaksi_id, akun_id, debit, kredit)
      VALUES (${crypto.randomUUID()}, ${txId}, ${b.akunId}, ${b.debit}, ${b.kredit})`;
  }
  await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'transaksi', txId, body.deskripsi);
  return c.json({ success: true, id: txId });
});

app.get('/api/akuntansi/transaksi/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  const status = c.req.query('status');
  if (user.role === 'NAZHIR') {
    const list = status 
      ? await sql`SELECT id, tanggal, kategori, deskripsi, total, status, catatan_review, created_at FROM transaksi WHERE nazhir_id = ${user.nazhirId} AND status = ${status} ORDER BY tanggal DESC`
      : await sql`SELECT id, tanggal, kategori, deskripsi, total, status, catatan_review, created_at FROM transaksi WHERE nazhir_id = ${user.nazhirId} ORDER BY tanggal DESC`;
    return c.json(list);
  }
  const list = await sql`SELECT t.id, t.tanggal, t.kategori, t.deskripsi, t.total, t.status, t.created_at, n.nama_lembaga FROM transaksi t JOIN nazhir n ON t.nazhir_id = n.id ORDER BY t.created_at DESC`;
  return c.json(list);
});

app.get('/api/akuntansi/transaksi/detail', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  const id = c.req.query('id') || '';
  const [tx] = await sql`SELECT id, nazhir_id, tanggal, kategori, deskripsi, total, status, catatan_review FROM transaksi WHERE id = ${id} LIMIT 1`;
  if (!tx) return c.json({ error: 'Not found' }, 404);
  if (user.role === 'NAZHIR' && tx.nazhir_id !== user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const baris = await sql`SELECT jb.debit, jb.kredit, a.kode, a.nama FROM jurnal_baris jb JOIN akun a ON jb.akun_id = a.id WHERE jb.transaksi_id = ${id}`;
  return c.json({ transaksi: tx, baris });
});

app.post('/api/akuntansi/transaksi/review', async (c) => {
  const { user } = getAuth(c);
  if (user.role !== 'ADMIN_ANI' && user.role !== 'VERIFIKATOR') return c.json({ error: 'Forbidden' }, 403);
  const sql = c.get('sql');
  const body = await c.req.json();
  const [tx] = await sql`SELECT id, nazhir_id, status FROM transaksi WHERE id = ${body.id} LIMIT 1`;
  if (!tx || tx.status !== 'DIAJUKAN') return c.json({ error: 'Invalid transaction status' }, 400);
  await sql`UPDATE transaksi SET status = ${body.status}, disetujui_oleh = ${user.id}, catatan_review = ${body.catatan ?? null} WHERE id = ${body.id}`;
  await logAudit(sql, tx.nazhir_id, user.id, body.status, 'transaksi', body.id, body.catatan ?? null);
  return c.json({ success: true });
});

app.get('/api/akuntansi/buku-besar', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const akunId = c.req.query('akunId') || '';
  const rows = await sql`SELECT t.tanggal, t.deskripsi, jb.debit, jb.kredit
    FROM jurnal_baris jb JOIN transaksi t ON jb.transaksi_id = t.id
    WHERE jb.akun_id = ${akunId} AND t.nazhir_id = ${user.nazhirId} AND t.status = 'DISETUJUI'
    ORDER BY t.tanggal`;
  return c.json(rows);
});

app.get('/api/akuntansi/neraca-saldo', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const rows = await sql`SELECT a.kode, a.nama, a.tipe, a.saldo_normal,
      COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.debit ELSE 0 END),0) AS total_debit,
      COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.kredit ELSE 0 END),0) AS total_kredit
    FROM akun a
    LEFT JOIN jurnal_baris jb ON jb.akun_id = a.id
    LEFT JOIN transaksi t ON t.id = jb.transaksi_id
    WHERE a.nazhir_id = ${user.nazhirId}
    GROUP BY a.id ORDER BY a.kode`;
  return c.json(rows);
});

app.get('/api/akuntansi/laporan-psak412', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const rows = await sql`SELECT a.tipe, a.saldo_normal,
      COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.debit ELSE 0 END),0) AS d,
      COALESCE(SUM(CASE WHEN t.status = 'DISETUJUI' THEN jb.kredit ELSE 0 END),0) AS k
    FROM akun a
    LEFT JOIN jurnal_baris jb ON jb.akun_id = a.id
    LEFT JOIN transaksi t ON t.id = jb.transaksi_id
    WHERE a.nazhir_id = ${user.nazhirId} GROUP BY a.id`;
  const agg: Record<string, number> = { ASET: 0, LIABILITAS: 0, ASET_NETO: 0, PENDAPATAN: 0, BEBAN: 0 };
  for (const r of rows as any[]) {
    const saldo = r.saldo_normal === 'DEBIT' ? r.d - r.k : r.k - r.d;
    agg[r.tipe] = (agg[r.tipe] ?? 0) + saldo;
  }
  const totalAset = agg.ASET;
  const totalLiabilitas = agg.LIABILITAS;
  const surplusDefisit = agg.PENDAPATAN - agg.BEBAN;
  const asetNeto = agg.ASET_NETO + surplusDefisit;
  return c.json({
    posisiKeuangan: {
      totalAset,
      totalLiabilitas,
      totalAsetNeto: asetNeto,
      balance: totalAset - (totalLiabilitas + asetNeto),
    },
    aktivitas: {
      totalPenerimaan: agg.PENDAPATAN,
      totalPenyaluranBeban: agg.BEBAN,
      surplusDefisit,
    },
  });
});

app.post('/api/akuntansi/aset-tetap/create', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await sql`INSERT INTO aset_tetap (id, nazhir_id, nama, kategori, nilai_perolehan, tanggal_perolehan, umur_manfaat_bulan, url_dokumen_legal)
    VALUES (${id}, ${user.nazhirId}, ${body.nama}, ${body.kategori}, ${body.nilaiPerolehan}, ${body.tanggalPerolehan}, ${body.umurManfaatBulan}, ${body.urlDokumenLegal ?? null})`;
  await logAudit(sql, user.nazhirId!, user.id, 'CREATE', 'aset_tetap', id, body.nama);
  return c.json({ success: true, id });
});

app.get('/api/akuntansi/aset-tetap/list', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const list = await sql`SELECT id, nama, kategori, nilai_perolehan, tanggal_perolehan, umur_manfaat_bulan, akumulasi_penyusutan, url_dokumen_legal, created_at
    FROM aset_tetap WHERE nazhir_id = ${user.nazhirId} ORDER BY created_at DESC`;
  return c.json(list);
});

app.post('/api/akuntansi/aset-tetap/penyusutan', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const aset = await sql`SELECT id, nilai_perolehan, umur_manfaat_bulan, akumulasi_penyusutan FROM aset_tetap
    WHERE nazhir_id = ${user.nazhirId} AND umur_manfaat_bulan > 0`;
  let diproses = 0;
  for (const a of aset as any[]) {
    const sudah = await sql`SELECT id FROM penyusutan_log WHERE aset_tetap_id = ${a.id} AND periode_bulan = ${body.periodeBulan} AND periode_tahun = ${body.periodeTahun} LIMIT 1`;
    if (sudah.length > 0) continue;
    const sisa = a.nilai_perolehan - a.akumulasi_penyusutan;
    if (sisa <= 0) continue;
    const bulanan = Math.floor(a.nilai_perolehan / a.umur_manfaat_bulan);
    const nilai = Math.min(bulanan, sisa);
    if (nilai <= 0) continue;
    const logId = crypto.randomUUID();
    await sql`INSERT INTO penyusutan_log (id, aset_tetap_id, periode_bulan, periode_tahun, nilai_penyusutan)
      VALUES (${logId}, ${a.id}, ${body.periodeBulan}, ${body.periodeTahun}, ${nilai})`;
    await sql`UPDATE aset_tetap SET akumulasi_penyusutan = akumulasi_penyusutan + ${nilai} WHERE id = ${a.id}`;
    diproses++;
  }
  await logAudit(sql, user.nazhirId!, user.id, 'PENYUSUTAN', 'aset_tetap', null, `${body.periodeBulan}/${body.periodeTahun}: ${diproses} aset`);
  return c.json({ success: true, diproses });
});

app.post('/api/akuntansi/tutup-buku', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  await assertVerifiedNazhir(sql, user);
  const body = await c.req.json();
  const [pending] = await sql`SELECT id FROM transaksi WHERE nazhir_id = ${user.nazhirId} AND status = 'DIAJUKAN' AND substr(tanggal,1,4) = ${String(body.periodeTahun)} LIMIT 1`;
  if (pending) return c.json({ error: 'Masih ada transaksi DIAJUKAN di tahun ini. Review dulu.' }, 400);
  try {
    await sql`INSERT INTO lock_period (id, nazhir_id, periode_tahun, dikunci_oleh) VALUES (${crypto.randomUUID()}, ${user.nazhirId}, ${body.periodeTahun}, ${user.id})`;
  } catch {
    return c.json({ error: 'Periode ini sudah ditutup' }, 409);
  }
  await logAudit(sql, user.nazhirId!, user.id, 'LOCK', 'lock_period', null, String(body.periodeTahun));
  return c.json({ success: true });
});

app.get('/api/akuntansi/audit-trail', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  if (!user.nazhirId) return c.json({ error: 'Forbidden' }, 403);
  const list = await sql`SELECT aksi, entitas, entitas_id, detail, created_at FROM audit_trail WHERE nazhir_id = ${user.nazhirId} ORDER BY created_at DESC LIMIT 200`;
  return c.json(list);
});

// File upload / static routes
app.post('/api/upload', async (c) => {
  const { user } = getAuth(c);
  const sql = c.get('sql');
  const bucket = env.R2_BUCKET as any;
  if (!bucket) return c.json({ error: 'Penyimpanan R2 tidak terkonfigurasi' }, 500);
  if (!user.nazhirId) return c.json({ error: 'Akun belum terhubung ke lembaga Nazhir' }, 403);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) return c.json({ error: 'File tidak ditemukan' }, 400);

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueKey = `${user.nazhirId}/${crypto.randomUUID()}.${fileExtension}`;
    const arrayBuffer = await file.arrayBuffer();

    await bucket.put(uniqueKey, arrayBuffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploaderUserId: user.id, nazhirId: user.nazhirId, fileName: file.name }
    });

    return c.json({ success: true, url: `/api/files/${uniqueKey}` });
  } catch (error: any) {
    return c.json({ error: 'Gagal mengunggah berkas: ' + error.message }, 500);
  }
});

app.get('/api/files/*', async (c) => {
  const { user } = getAuth(c);
  const bucket = env.R2_BUCKET as any;
  if (!bucket) return c.text('Penyimpanan R2 tidak terkonfigurasi', 500);

  const url = new URL(c.req.url);
  const key = url.pathname.replace(/^\/api\/files\//, '');
  if (!key) return c.text('File tidak ditemukan', 404);

  const fileNazhirId = key.split('/')[0];
  const hasAccess = user.role === 'ADMIN_ANI' || user.role === 'VERIFIKATOR' || (user.role === 'NAZHIR' && user.nazhirId === fileNazhirId);
  if (!hasAccess) return c.text('Forbidden', 403);

  try {
    const fileObject = await bucket.get(key);
    if (!fileObject) return c.text('Berkas tidak ditemukan', 404);

    const headers = new Headers();
    fileObject.writeHttpMetadata(headers);
    headers.set('etag', fileObject.httpEtag);
    headers.set('Cache-Control', 'private, max-age=3600');
    return new Response(fileObject.body, { headers });
  } catch (error: any) {
    return c.text('Gagal mengambil berkas: ' + error.message, 500);
  }
});

// Main Astro API Router match wrapper
export const ALL: APIRoute = async (context) => {
  return app.fetch(context.request, context.locals);
};