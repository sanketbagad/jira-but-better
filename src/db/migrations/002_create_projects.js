export async function up(pool) {
  await pool.query(`
    CREATE TABLE projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      key VARCHAR(10) NOT NULL,
      description TEXT DEFAULT '',
      color INTEGER DEFAULT 0 CHECK (color >= 0 AND color <= 5),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      starred BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX idx_projects_key ON projects (key);
    CREATE INDEX idx_projects_owner ON projects (owner_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS projects CASCADE');
}
