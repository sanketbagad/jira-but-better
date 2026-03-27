// Migration: Remove project_id requirement from HR tables
export async function up(pool) {
  await pool.query(`
    -- Drop the project_id column from offer_letters (it's no longer needed)
    ALTER TABLE offer_letters DROP COLUMN IF EXISTS project_id;
    
    -- Drop the project_id column from payslips (it's no longer needed)
    ALTER TABLE payslips DROP COLUMN IF EXISTS project_id;
    
    -- Drop old indexes if they exist
    DROP INDEX IF EXISTS idx_offer_letters_project;
    DROP INDEX IF EXISTS idx_payslips_project;
  `);
}

export async function down(pool) {
  await pool.query(`
    -- Add back project_id columns (nullable for rollback)
    ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
    ALTER TABLE payslips ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
  `);
}
