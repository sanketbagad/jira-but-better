/**
 * Migration: Create organizations, org_members, teams, team_members tables.
 * Add org_id FK to projects, offer_letters, payslips.
 */
export async function up(pool) {
  await pool.query(`
    -- Organizations table
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      domain VARCHAR(255),
      logo_url TEXT,
      description TEXT DEFAULT '',
      industry VARCHAR(100),
      size VARCHAR(50) CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
      website VARCHAR(500),
      address TEXT,
      settings JSONB DEFAULT '{}'::jsonb,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_org_slug ON organizations(slug);
    CREATE INDEX idx_org_domain ON organizations(domain) WHERE domain IS NOT NULL;

    -- Organization members (user ↔ org mapping with role)
    CREATE TABLE organization_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(30) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member')),
      invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, user_id)
    );

    CREATE INDEX idx_orgm_org ON organization_members(organization_id);
    CREATE INDEX idx_orgm_user ON organization_members(user_id);

    -- Teams within organizations
    CREATE TABLE teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      color INTEGER DEFAULT 0 CHECK (color >= 0 AND color <= 5),
      lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX idx_teams_org ON teams(organization_id);

    -- Team members
    CREATE TABLE team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(30) DEFAULT 'member'
        CHECK (role IN ('lead', 'member')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(team_id, user_id)
    );

    CREATE INDEX idx_teamm_team ON team_members(team_id);
    CREATE INDEX idx_teamm_user ON team_members(user_id);

    -- Add organization_id to projects
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

    -- Add organization_id to offer_letters
    ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_offer_letters_org ON offer_letters(organization_id);

    -- Add organization_id to payslips
    ALTER TABLE payslips ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_payslips_org ON payslips(organization_id);

    -- Add onboarding_completed flag to users
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

    -- Triggers for updated_at
    CREATE TRIGGER trg_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER trg_organization_members_updated_at
      BEFORE UPDATE ON organization_members
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    CREATE TRIGGER trg_teams_updated_at
      BEFORE UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

export async function down(pool) {
  await pool.query(`
    ALTER TABLE projects DROP COLUMN IF EXISTS organization_id;
    ALTER TABLE offer_letters DROP COLUMN IF EXISTS organization_id;
    ALTER TABLE payslips DROP COLUMN IF EXISTS organization_id;
    ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed;
    DROP TABLE IF EXISTS team_members CASCADE;
    DROP TABLE IF EXISTS teams CASCADE;
    DROP TABLE IF EXISTS organization_members CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;
  `);
}
