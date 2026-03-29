export async function up(client) {
  // Notifications table for real-time notifications
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      data JSONB DEFAULT '{}',
      read BOOLEAN DEFAULT FALSE,
      action_url VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Project invitations (for org members being invited to projects)
  await client.query(`
    CREATE TABLE IF NOT EXISTS project_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'developer',
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE(project_id, user_id)
    )
  `);

  // Indexes for performance
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(user_id, created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_project_invitations_user ON project_invitations(user_id, status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id)`);
}

export async function down(client) {
  await client.query(`DROP TABLE IF EXISTS project_invitations`);
  await client.query(`DROP TABLE IF EXISTS notifications`);
}
