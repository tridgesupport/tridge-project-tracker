import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { sendEmail } from '@/lib/brevo'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, name, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const token = randomUUID()
  await sql`
    INSERT INTO invites (email, name, role, token)
    VALUES (${email.toLowerCase().trim()}, ${name ?? null}, ${role ?? 'internal'}, ${token})
    ON CONFLICT DO NOTHING`

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`

  try {
    await sendEmail({
      to: email,
      subject: "You've been invited to Tridge Project Tracker",
      html: `<p>Hi${name ? ` ${name}` : ''},</p>
             <p>You've been invited to join the Tridge Project Tracker as a <strong>${role || 'internal'}</strong> user.</p>
             <p><a href="${inviteUrl}">Click here to set up your account</a></p>
             <p>This invite link expires in 7 days.</p>`,
    })
  } catch (err) {
    console.error('Failed to send invite email:', err)
    return NextResponse.json({ error: 'Failed to send invite email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
