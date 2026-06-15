import { Lucia } from "lucia";
import { PostgresJsAdapter } from "@lucia-auth/adapter-postgresql";
import type { Sql } from "postgres";

export function getLucia(sql: Sql, prod: boolean) {
  const adapter = new PostgresJsAdapter(sql, {
    user: "users",
    session: "sessions"
  });

  return new Lucia(adapter, {
    sessionCookie: {
      attributes: {
        secure: prod
      }
    },
    getUserAttributes: (attributes) => {
      return {
        email: attributes.email,
        role: attributes.role,
        nazhirId: attributes.nazhir_id
      };
    }
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
