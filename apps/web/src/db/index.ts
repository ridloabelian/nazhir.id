// D1 (SQLite) DB Adapter

export interface D1Database {
  prepare: (query: string) => any;
}

export function getDB(env: { DB: D1Database }) {
  if (!env || !env.DB) throw new Error("env.DB is missing. Bind D1 to 'DB'.");
  
  // Tagged template literal sql\`SELECT * FROM... \`
  const sql = async function (strings: TemplateStringsArray, ...values: any[]) {
    const query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? '?' : ''), '');
    const stmt = env.DB.prepare(query).bind(...values);
    const { results } = await stmt.all();
    return results;
  };

  return sql;
}
