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
      email = ${body.email ?? null},
      invoice_to_name = ${body.invoice_to_name ?? null},
      invoice_address = ${body.invoice_address ?? null},
      gstin = ${body.gstin ?? null},
      amount = ${body.amount ?? null},
      description_label = COALESCE(${body.description_label ?? null}, description_label),
      invoice_to_email = ${body.invoice_to_email ?? null},
      invoice_cc_emails = ${body.invoice_cc_emails ?? null},
      client_number = ${body.client_number ?? null},
      auto_invoice_active = COALESCE(${body.auto_invoice_active ?? null}, auto_invoice_active)
    WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    await sql`DELETE FROM clients WHERE id = ${id}`
  } catch (err) {
    // Postgres 23503 = foreign_key_violation — invoices.client_id is ON DELETE
    // RESTRICT so a client with invoice history can't be silently deleted.
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23503') {
      return NextResponse.json(
        { error: 'This client has invoice history and cannot be deleted. Set them to Inactive on the Invoices tab instead.' },
        { status: 409 }
      )
    }
    throw err
  }
  return NextResponse.json({ ok: true })
}
