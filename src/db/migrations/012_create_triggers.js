export async function up(pool) {
  // Create the trigger function for auto-updating updated_at
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const tables = [
    'users', 'projects', 'project_members', 'sprints',
    'tasks', 'invites', 'documents', 'flowcharts', 'github_connections'
  ];

  for (const table of tables) {
    await pool.query(`
      CREATE TRIGGER trg_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at()
    `);
  }
}

export async function down(pool) {
  const tables = [
    'users', 'projects', 'project_members', 'sprints',
    'tasks', 'invites', 'documents', 'flowcharts', 'github_connections'
  ];

  for (const table of tables) {
    await pool.query(`DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table}`);
  }

  await pool.query('DROP FUNCTION IF EXISTS update_updated_at()');
}
