export async function up(client) {
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;
  `);

  // Create index for token lookup
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
      ON users (email_verification_token)
      WHERE email_verification_token IS NOT NULL;
  `);
}

export async function down(client) {
  await client.query(`
    DROP INDEX IF EXISTS idx_users_email_verification_token;
    ALTER TABLE users
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS email_verification_token,
      DROP COLUMN IF EXISTS email_verification_expires;
  `);
}
