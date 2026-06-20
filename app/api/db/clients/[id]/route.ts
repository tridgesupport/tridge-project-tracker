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
  await sql`
    UPDATE clients SET
      name = COALESCE(${body.name ?? null}, name),
      contact = ${body.contact ?? null},
      email = ${body.email ?? null}
    WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
