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

  // Invoicing: billing profile columns on clients
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_to_name text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_address text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS gstin text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS amount numeric(12,2)`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS description_label text NOT NULL DEFAULT 'AMC'`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_to_email text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_cc_emails text`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_number integer UNIQUE`
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS auto_invoice_active boolean NOT NULL DEFAULT false`
  console.log('✓ clients invoicing columns')

  // Invoices table
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      invoice_number text NOT NULL UNIQUE,
      fy_code text NOT NULL,
      client_number integer NOT NULL,
      sequence_in_fy integer NOT NULL,
      period_month integer NOT NULL,
      period_year integer NOT NULL,
      amount numeric(12,2) NOT NULL,
      description text NOT NULL,
      invoice_to_name text NOT NULL,
      invoice_address text,
      gstin text,
      to_email text,
      cc_emails text,
      invoice_date date NOT NULL,
      status text NOT NULL CHECK (status IN ('sent', 'failed')),
      error_message text,
      sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (client_id, period_year, period_month)
    )`
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)`
  console.log('✓ invoices table')

  // Deleting a client should never silently wipe their invoice history —
  // block it instead (was CASCADE on the initial table creation).
  await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey`
  await sql`ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT`
  console.log('✓ invoices.client_id restrict-on-delete')

  // Manual/scheduled invoices: distinguish cron-generated recurring invoices
  // from ones created via the Create Invoice flow, and allow a "scheduled"
  // (not yet sent) status.
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'recurring' CHECK (source IN ('recurring', 'manual'))`
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date date`
  await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check`
  await sql`ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('scheduled', 'sent', 'failed'))`
  // The old blanket UNIQUE(client_id, period_year, period_month) prevented ANY
  // second invoice for a client/month. Only the recurring monthly cron needs
  // that guarantee (never double-bill the same period) — manual invoices should
  // be free to coexist with a recurring one, or with each other, in the same month.
  await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_period_year_period_month_key`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS invoices_recurring_period_uniq
    ON invoices(client_id, period_year, period_month) WHERE source = 'recurring'`
  console.log('✓ invoices source/scheduled_date/status')

  console.log('\nAll migrations complete!')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
