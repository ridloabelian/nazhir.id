import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../../db';
import { getLucia } from '../../../auth';

export const GET: APIRoute = async (context) => {
  const { key } = context.params;
  if (!key) {
    return new Response('File tidak ditemukan', { status: 404 });
  }

  const isProd = import.meta.env.PROD;
  const sql = getDB(env as any);
  const lucia = getLucia(sql, isProd);

  // 1. Cek Autentikasi Sesi
  const sessionId = context.cookies.get(lucia.sessionCookieName)?.value;
  if (!sessionId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { user } = await lucia.validateSession(sessionId);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Otorisasi Akses File
  // Format key: nazhirId/filename
  const parts = key.split('/');
  const fileNazhirId = parts[0];

  const hasAccess = 
    user.role === 'ADMIN_ANI' || 
    user.role === 'VERIFIKATOR' || 
    (user.role === 'NAZHIR' && user.nazhirId === fileNazhirId);

  if (!hasAccess) {
    return new Response('Forbidden: Anda tidak memiliki hak akses untuk berkas ini', { status: 403 });
  }

  // 3. Ambil Berkas dari R2
  const bucket = env.R2_BUCKET;
  if (!bucket) {
    return new Response('Penyimpanan R2 tidak terkonfigurasi', { status: 500 });
  }

  try {
    const fileObject = await bucket.get(key);
    if (!fileObject) {
      return new Response('Berkas tidak ditemukan di storage', { status: 404 });
    }

    const headers = new Headers();
    fileObject.writeHttpMetadata(headers);
    headers.set('etag', fileObject.httpEtag);
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(fileObject.body, {
      headers,
    });
  } catch (error: any) {
    return new Response('Gagal mengambil berkas: ' + error.message, { status: 500 });
  }
};
