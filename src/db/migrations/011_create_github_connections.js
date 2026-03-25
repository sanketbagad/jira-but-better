export async function up(pool) {
  await pool.query(`
    CREATE TABLE github_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
      owner VARCHAR(255) NOT NULL,
      repo VARCHAR(255) NOT NULL,
      access_token TEXT,
      connected_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_github_project ON github_connections (project_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS github_connections CASCADE');
}
