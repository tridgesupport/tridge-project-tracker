import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`SELECT id, name, email, role, team, created_at FROM users ORDER BY name`
  return NextResponse.json(rows)
}
