import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const team = body.role === 'client' ? 'client' : 'internal'

  await sql`
    UPDATE users SET
      name = COALESCE(${body.name ?? null}, name),
      role = COALESCE(${body.role ?? null}, role),
      team = ${team}
    WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
