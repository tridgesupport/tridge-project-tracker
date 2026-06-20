import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entity_id')
  const entityType = searchParams.get('entity_type')
  if (!entityId || !entityType)
    return NextResponse.json({ error: 'entity_id and entity_type required' }, { status: 400 })

  const rows = await sql`
    SELECT * FROM edit_log
    WHERE entity_id = ${entityId} AND entity_type = ${entityType}
    ORDER BY edited_at DESC`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  await sql`
    INSERT INTO edit_log (entity_type, entity_id, edited_by_email, edited_at, changes)
    VALUES (
      ${body.entity_type}, ${body.entity_id}, ${body.edited_by_email},
      ${body.edited_at ?? new Date().toISOString()}, ${JSON.stringify(body.changes ?? {})}
    )`
  return NextResponse.json({ ok: true })
}
