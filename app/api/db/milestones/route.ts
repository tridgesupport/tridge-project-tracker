import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const milestones = await sql`
    SELECT * FROM milestones WHERE project_id = ${projectId} ORDER BY created_at`
  const tasks = await sql`
    SELECT * FROM tasks WHERE project_id = ${projectId} ORDER BY created_at`

  const result = milestones.map((m: Record<string, unknown>) => ({
    ...m,
    tasks: tasks.filter((t: Record<string, unknown>) => t.milestone_id === m.id),
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.milestone_name?.trim())
    return NextResponse.json({ error: 'milestone_name required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO milestones (
      project_id, milestone_name, description, start_date, end_date,
      status, assigned_to, next_action_by, last_edited_by, last_edited_at, priority
    ) VALUES (
      ${body.project_id}, ${body.milestone_name.trim()}, ${body.description ?? null},
      ${body.start_date ?? null}, ${body.end_date ?? null},
      ${body.status ?? 'Pending'}, ${body.assigned_to ?? null},
      ${body.next_action_by ?? null}, ${body.last_edited_by ?? null},
      ${body.last_edited_at ?? null}, ${body.priority ?? null}
    ) RETURNING *`
  return NextResponse.json(rows[0])
}
