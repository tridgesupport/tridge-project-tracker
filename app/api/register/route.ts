import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { name, email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`
  if (existing[0]) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })

  const hash = await bcrypt.hash(password, 12)
  await sql`
    INSERT INTO users (name, email, password_hash, role, team)
    VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${hash}, 'internal', 'internal')`

  return NextResponse.json({ ok: true })
}
