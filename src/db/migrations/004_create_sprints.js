export async function up(pool) {
  await pool.query(`
    CREATE TABLE sprints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'planned'
        CHECK (status IN ('active', 'planned', 'completed', 'backlog')),
      start_date DATE,
      end_date DATE,
      goal TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_sprints_project ON sprints (project_id);
    CREATE INDEX idx_sprints_status ON sprints (status);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS sprints CASCADE');
}
