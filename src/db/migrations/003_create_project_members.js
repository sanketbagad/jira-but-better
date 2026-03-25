export async function up(pool) {
  await pool.query(`
    CREATE TABLE project_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'developer'
        CHECK (role IN ('admin', 'developer', 'designer', 'viewer', 'lead')),
      status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (project_id, user_id)
    );

    CREATE INDEX idx_pm_project ON project_members (project_id);
    CREATE INDEX idx_pm_user ON project_members (user_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS project_members CASCADE');
}
