import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await sql`
    SELECT i.*, c.name AS client_name
    FROM invoices i
    JOIN clients c ON c.id = i.client_id
    ORDER BY i.created_at DESC`
  return NextResponse.json(rows)
}
