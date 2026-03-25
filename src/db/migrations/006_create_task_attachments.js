export async function up(pool) {
  await pool.query(`
    CREATE TABLE task_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_name VARCHAR(500) NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_attachments_task ON task_attachments (task_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS task_attachments CASCADE');
}
