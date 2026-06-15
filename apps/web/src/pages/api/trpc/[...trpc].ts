import type { APIRoute } from 'astro';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../trpc/router';
import { createContext } from '../../../trpc/context';

export const ALL: APIRoute = (context) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: context.request,
    router: appRouter,
    createContext: () => createContext({
      request: context.request,
      cookies: context.cookies,
    }),
  });
};
