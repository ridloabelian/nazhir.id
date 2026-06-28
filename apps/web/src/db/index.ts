import postgres from 'postgres';

let sqlClient: postgres.Sql | null = null;

export function getDB(env: Record<string, string | undefined>) {
  if (!sqlClient) {
    const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing');
    }
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    sqlClient = postgres(connectionString, {
      ssl: isLocal ? false : 'require',
      max: 10,
      idle_timeout: 20,
    });
  }
  return sqlClient;
}
