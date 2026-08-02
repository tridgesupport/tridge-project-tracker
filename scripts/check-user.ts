import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  const rows = await sql`SELECT id, name, email, role, team, (password_hash IS NOT NULL) as has_hash FROM users LIMIT 10`
  console.log('Users in DB:')
  console.log(JSON.stringify(rows, null, 2))
}
main().catch(console.error)
