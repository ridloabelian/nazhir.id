import type { APIRoute } from 'astro';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../trpc/router';
import { createContext } from '../../../trpc/context';

export const ALL: APIRoute = async (context) => {
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
