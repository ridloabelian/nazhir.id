import postgres from 'postgres';

export function getDB(env: Record<string, string | undefined>) {
  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing');
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  return postgres(connectionString, {
    ssl: isLocal ? false : 'require',
    max: 1,
    idle_timeout: 1,
  });
}
