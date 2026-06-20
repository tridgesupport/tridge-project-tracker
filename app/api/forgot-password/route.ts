import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const users = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`
  // Always return success to avoid user enumeration
  if (!users[0]) return NextResponse.json({ ok: true })

  const token = randomUUID()
  await sql`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (${users[0].id as string}, ${token}, now() + interval '1 hour')`

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@tridge.co.in',
      to: email,
      subject: 'Reset your Tridge Tracker password',
      html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    })
  } catch (err) {
    console.error('Failed to send reset email:', err)
  }

  return NextResponse.json({ ok: true })
}
