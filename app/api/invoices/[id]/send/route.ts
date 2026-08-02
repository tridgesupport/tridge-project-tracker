import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sql } from '@/lib/db'
import { sendPendingInvoice } from '@/lib/invoice-generate'
import type { Invoice } from '@/types'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
  const invoice = rows[0] as Invoice | undefined
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status === 'sent') {
    return NextResponse.json({ error: 'This invoice has already been sent' }, { status: 409 })
  }

  const result = await sendPendingInvoice(invoice)
  if (result.outcome === 'failed') {
    return NextResponse.json({ error: result.error, invoiceNumber: result.invoiceNumber }, { status: 502 })
  }
  return NextResponse.json(result)
}
