import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const rows = await sql`SELECT * FROM projects WHERE id = ${id} LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  // Strip internal meta fields
  const { _changes, _editedByEmail, _notifyEmail, _notifyName, _projectName, ...updates } = body

  await sql`
    UPDATE projects SET
      project_name = COALESCE(${updates.project_name ?? null}, project_name),
      description = COALESCE(${updates.description !== undefined ? updates.description : null}, description),
      expected_start_date = ${updates.expected_start_date !== undefined ? updates.expected_start_date : null},
      expected_end_date = ${updates.expected_end_date !== undefined ? updates.expected_end_date : null},
      status = COALESCE(${updates.status ?? null}, status),
      owner_id = ${updates.owner_id !== undefined ? updates.owner_id : null},
      project_type = COALESCE(${updates.project_type ?? null}, project_type),
      customer_id = ${updates.customer_id !== undefined ? updates.customer_id : null},
      next_action_by = ${updates.next_action_by !== undefined ? updates.next_action_by : null},
      last_edited_by = COALESCE(${updates.last_edited_by ?? null}, last_edited_by),
      last_edited_at = COALESCE(${updates.last_edited_at ?? null}, last_edited_at),
      priority = ${updates.priority !== undefined ? updates.priority : null}
    WHERE id = ${id}`

  if (_changes && _editedByEmail && Object.keys(_changes).length > 0) {
    await sql`
      INSERT INTO edit_log (entity_type, entity_id, edited_by_email, edited_at, changes)
      VALUES ('project', ${id}, ${_editedByEmail}, now(), ${JSON.stringify(_changes)})`
  }

  if (_notifyEmail) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: _notifyEmail, toName: _notifyName, entityType: 'Project',
        entityName: _projectName, projectName: _projectName,
        appUrl: `${process.env.NEXT_PUBLIC_APP_URL}/projects/${id}`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
