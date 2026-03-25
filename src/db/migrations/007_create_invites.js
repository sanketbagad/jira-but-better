export async function up(pool) {
  await pool.query(`
    CREATE TABLE invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'developer'
        CHECK (role IN ('admin', 'developer', 'designer', 'viewer')),
      status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
      temp_password VARCHAR(255),
      token VARCHAR(255) UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_invites_project ON invites (project_id);
    CREATE INDEX idx_invites_email ON invites (email);
    CREATE INDEX idx_invites_token ON invites (token);
    CREATE INDEX idx_invites_status ON invites (status);
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS invites CASCADE');
}
