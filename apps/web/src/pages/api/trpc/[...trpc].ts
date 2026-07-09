import type { APIRoute } from 'astro';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../trpc/router';
import { createContext } from '../../../trpc/context';

const ALLOWED_ORIGINS = new Set(['https://nazhir.id', 'https://www.nazhir.id']);

export const ALL: APIRoute = async (context) => {
  if (context.request.method !== 'GET') {
    const origin = context.request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: 'Origin tidak diizinkan' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const ctx = await createContext({
    request: context.request,
    cookies: context.cookies,
  });

  return await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: context.request,
    router: appRouter,
    createContext: () => ctx,
  });
};
