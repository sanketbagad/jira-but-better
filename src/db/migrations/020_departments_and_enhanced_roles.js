/**
 * Migration 020: Departments & Enhanced Role Hierarchy
 *
 * - Creates `departments` table (org-scoped)
 * - Adds employee profile fields to `users`
 * - Expands organization_members roles to support
 *   owner | admin | hr | manager | developer | designer | viewer
 */
export async function up(pool) {
  await pool.query(`
    -- ===== 1. Departments =====
    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      head_id UUID REFERENCES users(id) ON DELETE SET NULL,
      parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      color INTEGER DEFAULT 0 CHECK (color >= 0 AND color <= 10),
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_id);
    CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);

    -- Trigger
    CREATE TRIGGER trg_departments_updated_at
      BEFORE UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    -- ===== 2. Enhance users table with employee profile fields =====
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_joining DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'full-time'
      CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'freelance'));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_status VARCHAR(30) DEFAULT 'active'
      CHECK (employee_status IN ('active', 'onboarding', 'on-leave', 'offboarded', 'suspended'));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
    CREATE INDEX IF NOT EXISTS idx_users_reports_to ON users(reports_to);
    CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
    CREATE INDEX IF NOT EXISTS idx_users_employee_status ON users(employee_status);

    -- ===== 3. Expand organization_members role constraint =====
    -- Drop old check constraint and add new one
    ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
    ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
      CHECK (role IN ('owner', 'admin', 'hr', 'manager', 'developer', 'designer', 'viewer'));
  `);
}

export async function down(pool) {
  await pool.query(`
    -- Remove user columns
    ALTER TABLE users DROP COLUMN IF EXISTS department_id;
    ALTER TABLE users DROP COLUMN IF EXISTS designation;
    ALTER TABLE users DROP COLUMN IF EXISTS employee_code;
    ALTER TABLE users DROP COLUMN IF EXISTS phone;
    ALTER TABLE users DROP COLUMN IF EXISTS date_of_joining;
    ALTER TABLE users DROP COLUMN IF EXISTS reports_to;
    ALTER TABLE users DROP COLUMN IF EXISTS employment_type;
    ALTER TABLE users DROP COLUMN IF EXISTS employee_status;
    ALTER TABLE users DROP COLUMN IF EXISTS address;
    ALTER TABLE users DROP COLUMN IF EXISTS bio;

    -- Drop departments
    DROP TABLE IF EXISTS departments CASCADE;

    -- Restore old constraint
    ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
    ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
      CHECK (role IN ('owner', 'admin', 'member'));
  `);
}
