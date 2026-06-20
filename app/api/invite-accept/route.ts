import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { token, password, name } = await req.json()
  if (!token || !password)
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  if (password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const invites = await sql`
    SELECT * FROM invites
    WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
    LIMIT 1`
  if (!invites[0]) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 400 })

  const invite = invites[0] as Record<string, unknown>
  const existing = await sql`SELECT id FROM users WHERE email = ${invite.email as string} LIMIT 1`
  if (existing[0]) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })

  const hash = await bcrypt.hash(password, 12)
  const userName = (name?.trim() || invite.name || invite.email) as string
  const team = invite.role === 'client' ? 'client' : 'internal'

  await sql`
    INSERT INTO users (name, email, password_hash, role, team)
    VALUES (${userName}, ${invite.email as string}, ${hash}, ${invite.role as string}, ${team})`

  await sql`UPDATE invites SET used_at = now() WHERE id = ${invite.id as string}`

  return NextResponse.json({ ok: true })
}
