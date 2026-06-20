import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { password, token } = await req.json()
  if (!password || password.length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const hash = await bcrypt.hash(password, 12)

  if (token) {
    // Token-based reset (forgot password flow)
    const tokens = await sql`
      SELECT * FROM password_reset_tokens
      WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
      LIMIT 1`
    if (!tokens[0]) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })

    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${tokens[0].user_id as string}`
    await sql`UPDATE password_reset_tokens SET used_at = now() WHERE id = ${tokens[0].id as string}`
    return NextResponse.json({ ok: true })
  }

  // Session-based change (logged-in user changing their own password)
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${session.user.id}`
  return NextResponse.json({ ok: true })
}
