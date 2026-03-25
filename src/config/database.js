import pg from 'pg';

const { Pool } = pg;

// Pooled connection (via PgBouncer) for app queries
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// Direct connection for migrations and DDL operations
export function createDirectPool() {
  return new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Execute a parameterized query.
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production' && duration > 200) {
    console.warn(`Slow query (${duration}ms):`, text.slice(0, 100));
  }
  return result;
}

/**
 * Get a client from the pool for transactions.
 */
export async function getClient() {
  const client = await pool.connect();
  const originalRelease = client.release.bind(client);
  let released = false;
  client.release = () => {
    if (released) return;
    released = true;
    originalRelease();
  };
  return client;
}

/**
 * Run a callback inside a transaction.
 */
export async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Pre-warm pool connections to avoid cold-start latency.
 */
export async function warmPool() {
  const min = parseInt(process.env.DB_POOL_MIN || '2');
  const promises = [];
  for (let i = 0; i < min; i++) {
    promises.push(
      pool.connect().then(client => { client.release(); })
        .catch(() => { /* ignore warmup failures */ })
    );
  }
  await Promise.all(promises);
}
