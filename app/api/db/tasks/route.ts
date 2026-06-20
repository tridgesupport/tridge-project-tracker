import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.task_name?.trim())
    return NextResponse.json({ error: 'task_name required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO tasks (
      milestone_id, project_id, task_name, description, comments, links,
      documentation_link, start_date, end_date, status, assigned_to,
      next_action_by, last_edited_by, last_edited_at, priority
    ) VALUES (
      ${body.milestone_id}, ${body.project_id}, ${body.task_name.trim()},
      ${body.description ?? null}, ${body.comments ?? null}, ${body.links ?? null},
      ${body.documentation_link ?? null}, ${body.start_date ?? null}, ${body.end_date ?? null},
      ${body.status ?? 'Pending'}, ${body.assigned_to ?? null},
      ${body.next_action_by ?? null}, ${body.last_edited_by ?? null},
      ${body.last_edited_at ?? null}, ${body.priority ?? null}
    ) RETURNING *`
  return NextResponse.json(rows[0])
}
