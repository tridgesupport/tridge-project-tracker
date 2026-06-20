import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { _changes, _editedByEmail, _notifyEmail, _notifyName, _projectName, _projectId, ...body } = await req.json()

  await sql`
    UPDATE milestones SET
      milestone_name = COALESCE(${body.milestone_name ?? null}, milestone_name),
      description = ${body.description !== undefined ? body.description : null},
      start_date = ${body.start_date !== undefined ? body.start_date : null},
      end_date = ${body.end_date !== undefined ? body.end_date : null},
      status = COALESCE(${body.status ?? null}, status),
      assigned_to = ${body.assigned_to !== undefined ? body.assigned_to : null},
      next_action_by = ${body.next_action_by !== undefined ? body.next_action_by : null},
      last_edited_by = COALESCE(${body.last_edited_by ?? null}, last_edited_by),
      last_edited_at = COALESCE(${body.last_edited_at ?? null}, last_edited_at),
      priority = ${body.priority !== undefined ? body.priority : null}
    WHERE id = ${id}`

  if (_changes && _editedByEmail && Object.keys(_changes).length > 0) {
    await sql`
      INSERT INTO edit_log (entity_type, entity_id, edited_by_email, edited_at, changes)
      VALUES ('milestone', ${id}, ${_editedByEmail}, now(), ${JSON.stringify(_changes)})`
  }

  if (_notifyEmail && _projectId) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: _notifyEmail, toName: _notifyName, entityType: 'Milestone',
        entityName: body.milestone_name, projectName: _projectName,
        appUrl: `${process.env.NEXT_PUBLIC_APP_URL}/projects/${_projectId}`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await sql`DELETE FROM milestones WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
