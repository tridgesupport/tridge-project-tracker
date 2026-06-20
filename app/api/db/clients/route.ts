import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`SELECT * FROM clients ORDER BY name`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO clients (name, contact, email)
    VALUES (${body.name.trim()}, ${body.contact ?? null}, ${body.email ?? null})
    RETURNING *`
  return NextResponse.json(rows[0])
}
