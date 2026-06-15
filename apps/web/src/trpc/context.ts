import type { AstroCookies } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../db';
import { getLucia } from '../auth';

export async function createContext({ request, cookies }: { request: Request; cookies: AstroCookies }) {
  const isProd = import.meta.env.PROD;
  const sqlClient = getDB(env as any);
  const lucia = getLucia(sqlClient, isProd);

  // Authenticate session from cookies
  const sessionId = cookies.get(lucia.sessionCookieName)?.value ?? null;

  let user = null;
  let session = null;

  if (sessionId) {
    try {
      const result = await lucia.validateSession(sessionId);
      user = result.user;
      session = result.session;
      
      // Refresh session cookie if required by Lucia
      if (session && session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      }
      if (!session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      }
    } catch (e) {
      // Ignored: expired or invalid session
    }
  }

  return {
    req: request,
    env,
    sql: sqlClient,
    lucia,
    user,
    session,
    cookies,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
