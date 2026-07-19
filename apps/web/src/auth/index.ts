import { Lucia, type Adapter, type DatabaseSession, type DatabaseUser } from "lucia";

type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

function makeD1Adapter(sql: Sql): Adapter {
  return {
    async getSessionAndUser(sessionId): Promise<[DatabaseSession | null, DatabaseUser | null]> {
      const [sRow] = await sql`SELECT id, user_id, expires_at FROM sessions WHERE id = ${sessionId} LIMIT 1`;
      if (!sRow) return [null, null];
      const [uRow] = await sql`SELECT id, email, role, nazhir_id FROM users WHERE id = ${sRow.user_id} LIMIT 1`;
      if (!uRow) return [null, null];
      const session: DatabaseSession = {
        id: sRow.id,
        userId: sRow.user_id,
        expiresAt: new Date(Number(sRow.expires_at) * 1000),
        attributes: {},
      };
      const user: DatabaseUser = {
        id: uRow.id,
        attributes: { email: uRow.email, role: uRow.role, nazhir_id: uRow.nazhir_id },
      };
      return [session, user];
    },
    async getUserSessions(userId): Promise<DatabaseSession[]> {
      const rows = await sql`SELECT id, user_id, expires_at FROM sessions WHERE user_id = ${userId}`;
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        expiresAt: new Date(Number(r.expires_at) * 1000),
        attributes: {},
      }));
    },
    async setSession(session): Promise<void> {
      const expiresUnix = Math.floor(session.expiresAt.getTime() / 1000);
      await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${session.id}, ${session.userId}, ${expiresUnix})`;
    },
    async updateSessionExpiration(sessionId, expiresAt): Promise<void> {
      const expiresUnix = Math.floor(expiresAt.getTime() / 1000);
      await sql`UPDATE sessions SET expires_at = ${expiresUnix} WHERE id = ${sessionId}`;
    },
    async deleteSession(sessionId): Promise<void> {
      await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
    },
    async deleteUserSessions(userId): Promise<void> {
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
    },
    async deleteExpiredSessions(): Promise<void> {
      const nowUnix = Math.floor(Date.now() / 1000);
      await sql`DELETE FROM sessions WHERE expires_at <= ${nowUnix}`;
    },
  };
}

export function getLucia(sql: Sql, prod: boolean) {
  const adapter = makeD1Adapter(sql);
  return new Lucia(adapter, {
    sessionCookie: {
      attributes: { secure: prod, sameSite: "lax", path: "/" },
    },
    getUserAttributes: (attributes) => ({
      email: attributes.email,
      role: attributes.role,
      nazhirId: attributes.nazhir_id,
    }),
  });
}

declare module "lucia" {
  interface Register {
    Lucia: ReturnType<typeof getLucia>;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: string;
  role: 'ADMIN_ANI' | 'VERIFIKATOR' | 'NAZHIR';
  nazhir_id: string | null;
}
