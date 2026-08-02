import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`SELECT * FROM clients ORDER BY name`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO clients (
      name, contact, email, invoice_to_name, invoice_address, gstin, amount,
      description_label, invoice_to_email, invoice_cc_emails, client_number, auto_invoice_active
    )
    VALUES (
      ${body.name.trim()}, ${body.contact ?? null}, ${body.email ?? null},
      ${body.invoice_to_name ?? null}, ${body.invoice_address ?? null}, ${body.gstin ?? null},
      ${body.amount ?? null}, ${body.description_label ?? 'AMC'}, ${body.invoice_to_email ?? null},
      ${body.invoice_cc_emails ?? null}, ${body.client_number ?? null}, ${body.auto_invoice_active ?? false}
    )
    RETURNING *`
  return NextResponse.json(rows[0])
}
