export async function up(pool) {
  await pool.query(`
    CREATE TABLE flowcharts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      description TEXT DEFAULT '',
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nodes JSONB DEFAULT '[]'::jsonb,
      connections JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_flowcharts_project ON flowcharts (project_id);
    CREATE INDEX idx_flowcharts_author ON flowcharts (author_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS flowcharts CASCADE');
}
