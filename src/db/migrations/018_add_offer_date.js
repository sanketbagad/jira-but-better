// Migration: Add offer_date column to offer_letters
export async function up(pool) {
  await pool.query(`
    ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS offer_date DATE DEFAULT CURRENT_DATE;
  `);
}

export async function down(pool) {
  await pool.query(`
    ALTER TABLE offer_letters DROP COLUMN IF EXISTS offer_date;
  `);
}
