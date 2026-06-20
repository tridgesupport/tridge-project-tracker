import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log('Running Neon schema migrations...')

  // Add password_hash column to users if not exists
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`
  console.log('✓ users.password_hash')

  // Add priority columns
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority integer CHECK (priority >= 1 AND priority <= 10)`
  await sql`ALTER TABLE milestones ADD COLUMN IF NOT EXISTS priority integer CHECK (priority >= 1 AND priority <= 10)`
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority integer CHECK (priority >= 1 AND priority <= 10)`
  console.log('✓ priority columns')

  // Comments table
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL CHECK (entity_type IN ('milestone', 'task')),
      entity_id uuid NOT NULL,
      author_id uuid REFERENCES users(id) ON DELETE SET NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_id, entity_type)`
  console.log('✓ comments table')

  // Invites table
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      name text,
      role text NOT NULL DEFAULT 'internal',
      token text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
      used_at timestamptz
    )`
  console.log('✓ invites table')

  // Password reset tokens table
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
      used_at timestamptz
    )`
  console.log('✓ password_reset_tokens table')

  console.log('\nAll migrations complete!')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
