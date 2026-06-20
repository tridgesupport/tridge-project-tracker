import { neon } from '@neondatabase/serverless'
import * as readline from 'readline'
import * as bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve))

async function main() {
  console.log('\n=== Create Admin User ===\n')
  const name = await ask('Name: ')
  const email = await ask('Email: ')
  const password = await ask('Password: ')

  if (!name || !email || !password) { console.error('All fields required'); process.exit(1) }
  if (password.length < 6) { console.error('Password must be at least 6 characters'); process.exit(1) }

  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`
  if (existing[0]) {
    await sql`UPDATE users SET password_hash = ${await bcrypt.hash(password, 12)}, role = 'admin', team = 'internal' WHERE email = ${email.toLowerCase().trim()}`
    console.log(`\n✓ Updated existing user ${email} to admin`)
  } else {
    const hash = await bcrypt.hash(password, 12)
    await sql`
      INSERT INTO users (name, email, password_hash, role, team)
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${hash}, 'admin', 'internal')`
    console.log(`\n✓ Admin user created: ${email}`)
  }

  rl.close()
}

main().catch(err => { console.error(err); process.exit(1) })
