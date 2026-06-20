import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows: Record<string, unknown>[]

  if (session.user.role === 'client') {
    const clientRows = await sql`SELECT id FROM clients WHERE email = ${session.user.email} LIMIT 1`
    const clientId = clientRows[0]?.id
    if (!clientId) return NextResponse.json([])
    rows = await sql`
      SELECT p.*,
        u_owner.id as owner__id, u_owner.name as owner__name, u_owner.email as owner__email,
        c.id as customer__id, c.name as customer__name,
        u_nab.id as nab__id, u_nab.name as nab__name, u_nab.email as nab__email,
        u_leb.id as leb__id, u_leb.name as leb__name, u_leb.email as leb__email
      FROM projects p
      LEFT JOIN users u_owner ON p.owner_id = u_owner.id
      LEFT JOIN clients c ON p.customer_id = c.id
      LEFT JOIN users u_nab ON p.next_action_by = u_nab.id
      LEFT JOIN users u_leb ON p.last_edited_by = u_leb.id
      WHERE p.customer_id = ${clientId}
      ORDER BY p.created_at DESC` as Record<string, unknown>[]
  } else {
    rows = await sql`
      SELECT p.*,
        u_owner.id as owner__id, u_owner.name as owner__name, u_owner.email as owner__email,
        c.id as customer__id, c.name as customer__name,
        u_nab.id as nab__id, u_nab.name as nab__name, u_nab.email as nab__email,
        u_leb.id as leb__id, u_leb.name as leb__name, u_leb.email as leb__email
      FROM projects p
      LEFT JOIN users u_owner ON p.owner_id = u_owner.id
      LEFT JOIN clients c ON p.customer_id = c.id
      LEFT JOIN users u_nab ON p.next_action_by = u_nab.id
      LEFT JOIN users u_leb ON p.last_edited_by = u_leb.id
      ORDER BY p.created_at DESC` as Record<string, unknown>[]
  }

  const projects = rows.map(r => ({
    id: r.id, project_name: r.project_name, description: r.description,
    expected_start_date: r.expected_start_date, expected_end_date: r.expected_end_date,
    status: r.status, owner_id: r.owner_id, project_type: r.project_type,
    customer_id: r.customer_id, next_action_by: r.next_action_by,
    last_edited_by: r.last_edited_by, last_edited_at: r.last_edited_at,
    created_at: r.created_at, priority: r.priority,
    owner: r.owner__id ? { id: r.owner__id, name: r.owner__name, email: r.owner__email } : null,
    customer: r.customer__id ? { id: r.customer__id, name: r.customer__name } : null,
    next_action_by_user: r.nab__id ? { id: r.nab__id, name: r.nab__name, email: r.nab__email } : null,
    last_edited_by_user: r.leb__id ? { id: r.leb__id, name: r.leb__name, email: r.leb__email } : null,
  }))

  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'internal'].includes(session.user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const rows = await sql`
    INSERT INTO projects (
      project_name, description, expected_start_date, expected_end_date,
      status, owner_id, project_type, customer_id, next_action_by,
      last_edited_by, last_edited_at, priority
    ) VALUES (
      ${body.project_name}, ${body.description ?? null},
      ${body.expected_start_date ?? null}, ${body.expected_end_date ?? null},
      ${body.status ?? 'Pending'}, ${body.owner_id ?? null},
      ${body.project_type ?? 'Internal R&D'}, ${body.customer_id ?? null},
      ${body.next_action_by ?? null}, ${body.last_edited_by ?? null},
      ${body.last_edited_at ?? null}, ${body.priority ?? null}
    ) RETURNING *`
  return NextResponse.json(rows[0])
}
