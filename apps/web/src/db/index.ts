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

  // Transaction stub (D1 batches) - since we just use it for single logic inside
  sql.begin = async function<T>(callback: (tx: typeof sql) => Promise<T>): Promise<T> {
    // Note: D1 batching exists, but this wrapper runs them sequentially inside the worker. 
    // This is safe for single-worker concurrent logic mostly.
    return callback(sql);
  };

  return sql;
}
