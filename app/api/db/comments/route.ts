import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityIdsParam = searchParams.get('entity_ids')
  if (!entityIdsParam) return NextResponse.json([])

  const entityIds = entityIdsParam.split(',').filter(Boolean)
  if (entityIds.length === 0) return NextResponse.json([])

  const rows = await sql`
    SELECT c.*, u.id as author__id, u.name as author__name, u.email as author__email,
      u.role as author__role, u.team as author__team, u.created_at as author__created_at
    FROM comments c
    LEFT JOIN users u ON c.author_id = u.id
    WHERE c.entity_id = ANY(${entityIds}::uuid[])
    ORDER BY c.created_at ASC`

  const comments = rows.map((r: Record<string, unknown>) => ({
    id: r.id, entity_type: r.entity_type, entity_id: r.entity_id,
    author_id: r.author_id, content: r.content, created_at: r.created_at,
    author: r.author__id ? {
      id: r.author__id, name: r.author__name, email: r.author__email,
      role: r.author__role, team: r.author__team, created_at: r.author__created_at,
    } : null,
  }))

  return NextResponse.json(comments)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO comments (entity_type, entity_id, author_id, content)
    VALUES (${body.entity_type}, ${body.entity_id}, ${body.author_id ?? null}, ${body.content.trim()})
    RETURNING *`
  return NextResponse.json(rows[0])
}
