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
