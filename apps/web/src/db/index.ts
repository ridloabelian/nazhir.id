import postgres from 'postgres';

let sqlClient: postgres.Sql | null = null;

export function getDB(env: Record<string, string | undefined>) {
  if (!sqlClient) {
    const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing');
    }
    sqlClient = postgres(connectionString, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
    });
  }
  return sqlClient;
}
