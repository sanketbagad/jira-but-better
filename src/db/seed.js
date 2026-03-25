import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../config/database.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('Pallavi@3338', 12);

  const { rows: users } = await query(`
    INSERT INTO users (name, email, password_hash, role, avatar) VALUES
      ('Alen Colins', 'alencolins@gmail.com', $1, 'admin', 'AC')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, name, email, role, avatar
  `, [adminHash]);

  if (users.length === 0) {
    console.log('Admin user already exists, skipping seed');
    await pool.end();
    return;
  }

  const admin = users[0];
  console.log('✅ Admin user created:', admin.email);
  console.log(`   1 user seeded`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
