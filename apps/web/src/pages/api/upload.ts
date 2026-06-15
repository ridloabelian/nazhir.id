import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../db';
import { getLucia } from '../../auth';

export const POST: APIRoute = async (context) => {
  const isProd = import.meta.env.PROD;
  const sql = getDB(env as any);
  const lucia = getLucia(sql, isProd);

  // 1. Cek Autentikasi
  const sessionId = context.cookies.get(lucia.sessionCookieName)?.value;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { user } = await lucia.validateSession(sessionId);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 2. Ambil File dari FormData
  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'File tidak ditemukan' }), { status: 400 });
    }

    // Validasi tipe file (PDF atau Gambar saja)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Tipe file tidak didukung. Hanya PDF atau Gambar (JPG/PNG/WEBP).' }), { status: 400 });
    }

    // Validasi ukuran file (Maksimal 5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return new Response(JSON.stringify({ error: 'Ukuran file maksimal 5MB.' }), { status: 400 });
    }

    // 3. Simpan ke Cloudflare R2
    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'Penyimpanan R2 tidak terkonfigurasi' }), { status: 500 });
    }

    const fileExtension = file.name.split('.').pop();
    const uniqueKey = `${user.nazhirId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;

    // Konversi file ke arrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    await bucket.put(uniqueKey, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploaderUserId: user.id,
        nazhirId: user.nazhirId || '',
        fileName: file.name,
      }
    });

    // Kembalikan path internal untuk diakses via /api/files/[key]
    const fileUrl = `/api/files/${uniqueKey}`;

    return new Response(JSON.stringify({ success: true, url: fileUrl }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Gagal mengunggah berkas: ' + error.message }), { status: 500 });
  }
};
