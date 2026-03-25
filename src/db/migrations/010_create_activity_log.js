export async function up(pool) {
  await pool.query(`
    CREATE TABLE activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(50) NOT NULL
        CHECK (action IN (
          'created', 'completed', 'moved', 'commented', 'assigned',
          'updated', 'deleted', 'invited', 'joined', 'uploaded'
        )),
      entity_type VARCHAR(50) NOT NULL
        CHECK (entity_type IN ('task', 'project', 'document', 'flowchart', 'member', 'sprint', 'invite')),
      entity_id UUID,
      entity_title VARCHAR(500),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_activity_project ON activity_log (project_id);
    CREATE INDEX idx_activity_user ON activity_log (user_id);
    CREATE INDEX idx_activity_created ON activity_log (created_at DESC);
    CREATE INDEX idx_activity_project_time ON activity_log (project_id, created_at DESC);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS activity_log CASCADE');
}
