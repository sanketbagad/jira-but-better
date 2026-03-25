export async function up(pool) {
  await pool.query(`
    CREATE TABLE documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'other'
        CHECK (category IN ('requirements', 'design', 'technical', 'meeting', 'other')),
      content TEXT DEFAULT '',
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
      word_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE document_collaborators (
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (document_id, user_id)
    );

    CREATE INDEX idx_documents_project ON documents (project_id);
    CREATE INDEX idx_documents_category ON documents (category);
    CREATE INDEX idx_documents_author ON documents (author_id);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS document_collaborators CASCADE');
  await pool.query('DROP TABLE IF EXISTS documents CASCADE');
}
