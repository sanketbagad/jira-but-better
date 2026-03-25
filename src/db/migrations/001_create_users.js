export async function up(pool) {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'developer'
        CHECK (role IN ('admin', 'developer', 'designer', 'viewer', 'client')),
      avatar VARCHAR(10),
      is_active BOOLEAN DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_users_email ON users (email);
    CREATE INDEX idx_users_role ON users (role);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS users CASCADE');
}
