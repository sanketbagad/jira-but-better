import 'dotenv/config';
import { createDirectPool } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const pool = createDirectPool();
const query = (text, params) => pool.query(text, params);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations() {
  const result = await query('SELECT name FROM _migrations ORDER BY id');
  return result.rows.map(r => r.name);
}

async function runMigrations(direction = 'up') {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (direction === 'up') {
    for (const file of files) {
      if (executed.includes(file)) continue;
      console.log(`⬆️  Running migration: ${file}`);
      const migrationPath = new URL(`file:///${path.join(migrationsDir, file).replace(/\\/g, '/')}`);
      const migration = await import(migrationPath.href);
      await migration.up(pool);
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`✅ ${file} applied`);
    }
  } else if (direction === 'down') {
    const reversed = [...files].reverse();
    for (const file of reversed) {
      if (!executed.includes(file)) continue;
      console.log(`⬇️  Rolling back: ${file}`);
      const migrationPath = new URL(`file:///${path.join(migrationsDir, file).replace(/\\/g, '/')}`);
      const migration = await import(migrationPath.href);
      await migration.down(pool);
      await query('DELETE FROM _migrations WHERE name = $1', [file]);
      console.log(`✅ ${file} rolled back`);
    }
  }

  console.log('🎉 Migrations complete');
  await pool.end();
}

const direction = process.argv[2] || 'up';
runMigrations(direction).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
